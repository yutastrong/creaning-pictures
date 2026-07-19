import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
const displayName = process.argv[3] ?? email?.split("@")[0];
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!email || !supabaseUrl || !serviceKey) {
  throw new Error("Email and Supabase administrator environment variables are required.");
}

const temporaryPassword = `${crypto.randomBytes(9).toString("base64url")}aA7!`;
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken:false, persistSession:false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password: temporaryPassword,
  email_confirm: true,
  user_metadata: { display_name:displayName },
});

if (error) throw error;

const { error: profileError } = await supabase
  .from("profiles")
  .update({ display_name:displayName, role:"admin" })
  .eq("id", data.user.id);

if (profileError) throw profileError;

console.log(JSON.stringify({ email, displayName, temporaryPassword }));
