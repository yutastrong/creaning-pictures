import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) throw new Error("Supabase admin environment variables are missing.");
  return createClient(url, serviceKey, {
    auth: { persistSession:false, autoRefreshToken:false },
  });
}

async function authorizeAdmin(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await admin.from("profiles").select("role, is_active").eq("id", user.id).single();
  if (profile?.role !== "admin" || !profile.is_active) return null;
  return { admin, user };
}

function errorResponse(message: string, status=400) {
  return NextResponse.json({ error:message }, { status });
}

export async function GET(request: NextRequest) {
  const authorized = await authorizeAdmin(request);
  if (!authorized) return errorResponse("管理者権限が必要です", 403);
  const { admin } = authorized;
  const [{ data: authData, error:authError }, { data:profiles, error:profileError }] = await Promise.all([
    admin.auth.admin.listUsers({ page:1, perPage:1000 }),
    admin.from("profiles").select("id, email, display_name, role, is_active, created_at"),
  ]);
  if (authError || profileError) return errorResponse("メンバーを読み込めませんでした", 500);
  const profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]));
  const members = authData.users.map(user => {
    const profile = profileMap.get(user.id);
    return {
      id:user.id,
      email:profile?.email ?? user.email ?? "",
      displayName:profile?.display_name ?? user.user_metadata?.display_name ?? "",
      role:profile?.role ?? "staff",
      isActive:profile?.is_active ?? true,
      status:profile?.is_active === false ? "stopped" : user.last_sign_in_at ? "active" : "invited",
      lastSignInAt:user.last_sign_in_at ?? null,
      createdAt:profile?.created_at ?? user.created_at,
    };
  });
  return NextResponse.json({ members });
}

export async function POST(request: NextRequest) {
  const authorized = await authorizeAdmin(request);
  if (!authorized) return errorResponse("管理者権限が必要です", 403);
  const { admin } = authorized;
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const displayName = String(body.displayName ?? "").trim();
  const role = body.role === "admin" ? "admin" : "staff";
  if (!email || !displayName) return errorResponse("名前とメールアドレスを入力してください");

  const redirectTo = new URL("/", request.nextUrl.origin).toString();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data:{ display_name:displayName, must_set_password:true },
    redirectTo,
  });
  if (error || !data.user) return errorResponse(error?.message ?? "招待メールを送信できませんでした");
  const { error:profileError } = await admin.from("profiles").upsert({
    id:data.user.id,
    email,
    display_name:displayName,
    role,
    is_active:true,
  });
  if (profileError) return errorResponse("プロフィールを登録できませんでした", 500);
  return NextResponse.json({ ok:true });
}

export async function PATCH(request: NextRequest) {
  const authorized = await authorizeAdmin(request);
  if (!authorized) return errorResponse("管理者権限が必要です", 403);
  const { admin, user:currentUser } = authorized;
  const body = await request.json();
  const id = String(body.id ?? "");
  const action = String(body.action ?? "edit");
  if (!id) return errorResponse("メンバーを選択してください");

  if (action === "edit") {
    const displayName = String(body.displayName ?? "").trim();
    const role = body.role === "admin" ? "admin" : "staff";
    if (!displayName) return errorResponse("名前を入力してください");
    if (id === currentUser.id && role !== "admin") return errorResponse("自分自身の管理者権限は外せません");
    const [{ error:profileError }, { error:authError }] = await Promise.all([
      admin.from("profiles").update({ display_name:displayName, role }).eq("id", id),
      admin.auth.admin.updateUserById(id, { user_metadata:{ display_name:displayName } }),
    ]);
    if (profileError || authError) return errorResponse("メンバー情報を更新できませんでした", 500);
  } else if (action === "stop" || action === "activate") {
    if (id === currentUser.id && action === "stop") return errorResponse("自分自身は利用停止にできません");
    const isActive = action === "activate";
    const [{ error:profileError }, { error:authError }] = await Promise.all([
      admin.from("profiles").update({ is_active:isActive }).eq("id", id),
      admin.auth.admin.updateUserById(id, { ban_duration:isActive ? "none" : "876000h" }),
    ]);
    if (profileError || authError) return errorResponse("利用状態を変更できませんでした", 500);
  } else if (action === "password_reset") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email) return errorResponse("メールアドレスを確認してください");
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || !publicKey) return errorResponse("メール設定を確認してください", 500);
    const publicClient = createClient(url, publicKey, { auth:{ persistSession:false, autoRefreshToken:false } });
    const { error } = await publicClient.auth.resetPasswordForEmail(email, {
      redirectTo:new URL("/", request.nextUrl.origin).toString(),
    });
    if (error) return errorResponse("設定メールを送信できませんでした");
  } else {
    return errorResponse("不明な操作です");
  }
  return NextResponse.json({ ok:true });
}
