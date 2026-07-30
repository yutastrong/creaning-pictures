"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { zip } from "fflate";
import { supabase } from "@/lib/supabase/client";
import { getQueuedPhotos, removeQueuedPhoto, removeQueuedPhotosForUser, saveQueuedPhoto, type QueuedPhoto } from "@/lib/offline-photo-queue";

type PhotoItem = {
  id: string | number;
  site: string;
  work: string;
  member: string;
  time: string;
  memo: string;
  comments: number;
  image: string;
};

type MemberItem = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "staff";
  isActive: boolean;
  status: "active" | "invited" | "stopped";
  lastSignInAt: string | null;
  createdAt: string;
};

const photos: PhotoItem[] = [
  { id: 1, site: "第二小学校", work: "トイレ清掃", member: "山田 太郎", time: "2024/06/15 10:32", memo: "男子トイレの作業完了", comments: 1, image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=85" },
  { id: 2, site: "第二小学校", work: "トイレ清掃", member: "山田 太郎", time: "2024/06/15 10:28", memo: "個室内を確認済み", comments: 0, image: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=900&q=85" },
  { id: 3, site: "第二小学校", work: "トイレ清掃", member: "山田 太郎", time: "2024/06/15 10:25", memo: "洗面台の清掃完了", comments: 0, image: "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=900&q=85" },
  { id: 4, site: "第二小学校", work: "トイレ清掃", member: "鈴木 花子", time: "2024/06/15 09:58", memo: "床面を洗浄しました", comments: 2, image: "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=900&q=85" },
  { id: 5, site: "みらいマンション", work: "定期清掃", member: "佐藤 一郎", time: "2024/06/14 16:42", memo: "共用廊下の清掃完了", comments: 0, image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=85" },
  { id: 6, site: "みらいマンション", work: "定期清掃", member: "佐藤 一郎", time: "2024/06/14 16:38", memo: "窓枠の拭き上げ完了", comments: 0, image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85" },
  { id: 7, site: "しんじゅくビル", work: "定期清掃", member: "田中 美咲", time: "2024/06/14 15:21", memo: "エントランス確認済み", comments: 0, image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=85" },
  { id: 8, site: "第一工場", work: "配管", member: "高橋 健", time: "2024/06/14 11:07", memo: "ポンプ周辺に異常なし", comments: 0, image: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=900&q=85" },
  { id: 9, site: "第一工場", work: "配管", member: "高橋 健", time: "2024/06/14 11:02", memo: "配管接続部を確認", comments: 0, image: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=900&q=85" },
];

const siteMap: Record<string, string[]> = {
  "トイレ清掃": ["第二小学校", "第三小学校", "それ以外"],
  "定期清掃": ["みらいマンション", "しんじゅくビル", "それ以外"],
  "配管": ["第一工場", "それ以外"],
  "巡回清掃": ["みらいマンション", "しんじゅくビル", "それ以外"],
  "日常清掃": ["第二小学校", "第三小学校", "それ以外"],
  "その他": ["それ以外"],
};

function Icon({ children }: { children: React.ReactNode }) { return <span aria-hidden="true" className="icon">{children}</span>; }

function formatLocalDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function withTimeout<T>(promise: PromiseLike<T>, milliseconds=20000) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("送信がタイムアウトしました")), milliseconds);
    Promise.resolve(promise).then(
      value => { window.clearTimeout(timer); resolve(value); },
      error => { window.clearTimeout(timer); reject(error); },
    );
  });
}

export default function Home() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [profile, setProfile] = useState<{ display_name:string; role:"admin"|"staff"; is_active:boolean } | null>(null);
  const [mobileTab, setMobileTab] = useState<"capture" | "photos">("capture");
  const [desktopSection, setDesktopSection] = useState<"photos" | "categories" | "members">("photos");
  const [categoryData, setCategoryData] = useState<Record<string, string[]>>(siteMap);
  const [work, setWork] = useState("トイレ清掃");
  const [site, setSite] = useState("第二小学校");
  const [memo, setMemo] = useState("");
  const [toast, setToast] = useState("");
  const [cameraError, setCameraError] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<PhotoItem[]>([]);
  const [masterIds, setMasterIds] = useState<Record<string, { workId:string; sites:Record<string,string> }>>({});
  const [filters, setFilters] = useState({ work: "すべて", site: "すべて", member: "すべて" });
  const [selected, setSelected] = useState<PhotoItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<PhotoItem["id"]>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDownloadError, setBulkDownloadError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountPasswordOpen, setAccountPasswordOpen] = useState(false);
  const [queueStatus, setQueueStatus] = useState({ pending:0, sending:0, failed:0 });
  const [syncNotice, setSyncNotice] = useState("");
  const [savingLocally, setSavingLocally] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const masterSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSyncingRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setAuthLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setCapturedPhotos([]);
      return;
    }
    loadSupabaseData(user.id);
  }, [user]);

  useEffect(() => {
    const savedWork = localStorage.getItem("field-work");
    const savedSite = localStorage.getItem("field-site");
    if (savedWork && siteMap[savedWork]) setWork(savedWork);
    if (savedSite) setSite(savedSite);
    return stopCamera;
  }, []);

  async function loadSupabaseData(userId: string) {
    const [{ data: profileRow }, { data: workRows }, { data: siteRows }, { data: photoRows }] = await Promise.all([
      supabase.from("profiles").select("display_name, role, is_active").eq("id", userId).single(),
      supabase.from("work_items").select("id, name, sort_order").order("sort_order"),
      supabase.from("sites").select("id, work_item_id, name, sort_order").eq("is_active", true).order("sort_order"),
      supabase.from("photos").select("id, memo, image_path, captured_at, member_name, work_items(name), sites(name)").order("captured_at", { ascending:false }),
    ]);
    if (profileRow) {
      if (!profileRow.is_active) {
        await supabase.auth.signOut();
        return;
      }
      setProfile(profileRow);
    }
    if (workRows && siteRows) {
      const nextData: Record<string,string[]> = {};
      const nextIds: Record<string,{workId:string;sites:Record<string,string>}> = {};
      for (const workRow of workRows) {
        const matchingSites = siteRows.filter(row => row.work_item_id === workRow.id);
        nextData[workRow.name] = matchingSites.map(row => row.name);
        nextIds[workRow.name] = {
          workId: workRow.id,
          sites: Object.fromEntries(matchingSites.map(row => [row.name, row.id])),
        };
      }
      setCategoryData(nextData);
      setMasterIds(nextIds);
      const preferredWork = nextData[work] ? work : Object.keys(nextData)[0];
      if (preferredWork) {
        setWork(preferredWork);
        if (!nextData[preferredWork].includes(site)) setSite(nextData[preferredWork][0] ?? "");
      }
    }
    if (photoRows) {
      const mapped = await Promise.all(photoRows.map(async row => {
        const { data: signed } = await supabase.storage.from("field-photos").createSignedUrl(row.image_path, 3600);
        const workRelation = row.work_items as unknown as { name:string } | null;
        const siteRelation = row.sites as unknown as { name:string } | null;
        return {
          id: row.id,
          site: siteRelation?.name ?? "",
          work: workRelation?.name ?? "",
          member: row.member_name,
          time: formatLocalDateTime(new Date(row.captured_at)),
          memo: row.memo,
          comments: 0,
          image: signed?.signedUrl ?? "",
        } satisfies PhotoItem;
      }));
      setCapturedPhotos(mapped);
    }
  }

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const handleViewportChange = () => {
      if (!user || !mobileQuery.matches) {
        stopCamera();
        return;
      }
      if (mobileTab === "capture") void startCamera();
    };
    handleViewportChange();
    mobileQuery.addEventListener("change", handleViewportChange);
    return () => mobileQuery.removeEventListener("change", handleViewportChange);
  }, [mobileTab, user]);

  useEffect(() => {
    const reconnectCamera = () => {
      if (user && document.visibilityState === "visible" && mobileTab === "capture" && window.matchMedia("(max-width: 760px)").matches) void startCamera();
    };
    document.addEventListener("visibilitychange", reconnectCamera);
    return () => document.removeEventListener("visibilitychange", reconnectCamera);
  }, [mobileTab, user]);

  useEffect(() => {
    if (!user || !profile) return;
    const sync = () => void syncQueuedPhotos();
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    void refreshQueueStatus(user.id);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", syncWhenVisible);
    const timer = window.setInterval(sync, 15000);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.clearInterval(timer);
    };
  }, [user, profile]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeAccountMenu = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", closeAccountMenu);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeAccountMenu);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [accountMenuOpen]);

  async function startCamera() {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError(true); return; }
    try {
      const activeStream = streamRef.current;
      if (activeStream?.getVideoTracks().some(track => track.readyState === "live")) {
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
          await videoRef.current.play();
        }
        setCameraError(false);
        return;
      }
      activeStream?.getTracks().forEach(track => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      streamRef.current = stream;
      stream.getVideoTracks().forEach(track => { track.onended = () => setCameraError(true); });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraError(false);
    } catch { setCameraError(true); }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function changeWork(value: string) {
    setWork(value); localStorage.setItem("field-work", value);
    const nextSite = categoryData[value][0]; setSite(nextSite); localStorage.setItem("field-site", nextSite);
  }

  function changeSite(value: string) { setSite(value); localStorage.setItem("field-site", value); }

  function updateMasterData(next: Record<string, string[]>) {
    setCategoryData(next);
    const categoryNames = Object.keys(next);
    if (!next[work]) {
      const nextWork = categoryNames[0] ?? "";
      setWork(nextWork);
      setSite(next[nextWork]?.[0] ?? "");
    } else if (!next[work].includes(site)) {
      setSite(next[work][0] ?? "");
    }
    if (masterSyncTimerRef.current) clearTimeout(masterSyncTimerRef.current);
    masterSyncTimerRef.current = setTimeout(() => syncMasterData(next), 500);
  }

  async function syncMasterData(next: Record<string,string[]>) {
    if (!user || profile?.role !== "admin") return;
    const { data: currentWorks } = await supabase.from("work_items").select("id, name, sort_order").order("sort_order");
    if (!currentWorks) return;
    const currentNames = currentWorks.map(row => row.name);
    const nextNames = Object.keys(next);
    const removedWorks = currentWorks.filter(row => !nextNames.includes(row.name));
    const addedWorkNames = nextNames.filter(name => !currentNames.includes(name));

    if (removedWorks.length === 1 && addedWorkNames.length === 1 && currentNames.length === nextNames.length) {
      await supabase.from("work_items").update({ name:addedWorkNames[0] }).eq("id", removedWorks[0].id);
    } else {
      for (const removed of removedWorks) await supabase.from("work_items").delete().eq("id", removed.id);
      for (const name of addedWorkNames) await supabase.from("work_items").insert({ name, sort_order:(nextNames.indexOf(name) + 1) * 10 });
    }

    const { data: refreshedWorks } = await supabase.from("work_items").select("id, name");
    if (!refreshedWorks) return;
    for (const workRow of refreshedWorks) {
      const desiredSites = next[workRow.name] ?? [];
      const { data: currentSites } = await supabase.from("sites").select("id, name, is_active").eq("work_item_id", workRow.id).order("sort_order");
      if (!currentSites) continue;
      const activeSites = currentSites.filter(row => row.is_active);
      const activeSiteNames = activeSites.map(row => row.name);
      const removedSites = activeSites.filter(row => !desiredSites.includes(row.name));
      const addedSites = desiredSites.filter(name => !activeSiteNames.includes(name));
      if (removedSites.length === 1 && addedSites.length === 1 && activeSiteNames.length === desiredSites.length) {
        await supabase.from("sites").update({ name:addedSites[0] }).eq("id", removedSites[0].id);
      } else {
        for (const removed of removedSites) {
          await supabase.from("sites").update({ is_active:false }).eq("id", removed.id);
        }
        for (const name of addedSites) {
          const inactiveSite = currentSites.find(row => row.name === name && !row.is_active);
          if (inactiveSite) {
            await supabase.from("sites").update({ is_active:true, sort_order:(desiredSites.indexOf(name) + 1) * 10 }).eq("id", inactiveSite.id);
          } else {
            await supabase.from("sites").insert({ work_item_id:workRow.id, name, is_active:true, sort_order:(desiredSites.indexOf(name) + 1) * 10 });
          }
        }
      }
    }
    await loadSupabaseData(user.id);
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setPendingPhoto(photos[0].image);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 768;
    const sourceRatio = video.videoWidth / video.videoHeight;
    const targetRatio = 4 / 3;
    let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
    if (sourceRatio > targetRatio) {
      sw = video.videoHeight * targetRatio;
      sx = (video.videoWidth - sw) / 2;
    } else {
      sh = video.videoWidth / targetRatio;
      sy = (video.videoHeight - sh) / 2;
    }
    canvas.getContext("2d")?.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    setPendingPhoto(canvas.toDataURL("image/jpeg", 0.75));
  }

  async function refreshQueueStatus(userId: string) {
    try {
      const queued = await getQueuedPhotos(userId);
      setQueueStatus({
        pending: queued.filter(photo => photo.status === "pending").length,
        sending: queued.filter(photo => photo.status === "sending").length,
        failed: queued.filter(photo => photo.status === "failed").length,
      });
    } catch {
      setQueueStatus({ pending:0, sending:0, failed:0 });
    }
  }

  async function uploadQueuedImage(photo: QueuedPhoto) {
    let imageData = photo.imageData;
    if (!imageData && photo.imageBlob) imageData = await photo.imageBlob.arrayBuffer();
    if (!imageData || imageData.byteLength < 1000) {
      throw new Error("端末内の写真データが壊れています");
    }
    const uploadBlob = new Blob([imageData], { type:"image/jpeg" });
    const { error } = await withTimeout(
      supabase.storage
        .from("field-photos")
        .upload(photo.imagePath, uploadBlob, {
          contentType:"image/jpeg",
          upsert:true,
        }),
      20000,
    );
    if (error) throw new Error(error.message);
  }

  async function syncQueuedPhotos() {
    if (!user || queueSyncingRef.current || !navigator.onLine) return;
    queueSyncingRef.current = true;
    setSyncNotice("");
    let savedCount = 0;
    try {
      const queued = (await getQueuedPhotos(user.id)).filter(photo => photo.status !== "failed");
      for (const photo of queued) {
        if (!navigator.onLine) break;
        const attempts = (photo.attempts ?? 0) + 1;
        await saveQueuedPhoto({ ...photo, status:"sending", attempts, lastError:undefined });
        await refreshQueueStatus(user.id);
        try {
          await uploadQueuedImage(photo);
          const { error: insertError } = await withTimeout(supabase.from("photos").insert({
            id: photo.id,
            work_item_id: photo.workItemId,
            site_id: photo.siteId,
            member_id: photo.userId,
            member_name: photo.memberName,
            memo: photo.memo,
            image_path: photo.imagePath,
            captured_at: photo.capturedAt,
          }));
          if (insertError) {
            const { data: existingPhoto } = await withTimeout(supabase.from("photos").select("id").eq("id", photo.id).maybeSingle());
            if (!existingPhoto) throw insertError;
          }
          await removeQueuedPhoto(photo.id);
          savedCount += 1;
          await refreshQueueStatus(user.id);
        } catch (sendError) {
          const reason = sendError instanceof Error ? sendError.message : "通信エラー";
          const permanentlyFailed = attempts >= 3 || reason.includes("写真データが壊れています");
          await saveQueuedPhoto({ ...photo, status:permanentlyFailed ? "failed" : "pending", attempts, lastError:reason });
          setSyncNotice(permanentlyFailed ? "送信できない写真を分離しました" : `送信失敗: ${reason.slice(0, 80)}`);
          await refreshQueueStatus(user.id);
        }
      }
      if (savedCount > 0) {
        setSyncNotice(`✓ ${savedCount}件を保存しました`);
        window.setTimeout(() => setSyncNotice(""), 3000);
        void loadSupabaseData(user.id);
      }
    } catch {
      setSyncNotice("未送信写真を確認できませんでした");
    } finally {
      queueSyncingRef.current = false;
      await refreshQueueStatus(user.id);
    }
  }

  async function discardQueuedPhotos() {
    if (!user || queueSyncingRef.current) return;
    if (!window.confirm("未送信の写真をすべて削除しますか？\n削除した写真は元に戻せません。")) return;
    try {
      await removeQueuedPhotosForUser(user.id);
      setQueueStatus({ pending:0, sending:0, failed:0 });
      setSyncNotice("");
      setToast("未送信の写真を削除しました");
      window.setTimeout(() => setToast(""), 2400);
    } catch {
      setToast("未送信の写真を削除できませんでした");
    }
  }

  async function retryFailedPhotos() {
    if (!user || queueSyncingRef.current) return;
    try {
      const queued = await getQueuedPhotos(user.id);
      await Promise.all(queued.filter(photo => photo.status === "failed").map(photo =>
        saveQueuedPhoto({ ...photo, status:"pending", attempts:0, lastError:undefined })
      ));
      setSyncNotice("再送を開始します");
      await refreshQueueStatus(user.id);
      void syncQueuedPhotos();
    } catch {
      setSyncNotice("再送を開始できませんでした");
    }
  }

  async function savePhoto() {
    if (!pendingPhoto || !user || !profile) return;
    const workInfo = masterIds[work];
    const siteId = workInfo?.sites[site];
    if (!workInfo || !siteId) {
      setToast("保存先を確認してください");
      return;
    }

    const photoDataUrl = pendingPhoto;
    const queuedMemo = memo;
    const queueId = crypto.randomUUID();
    setPendingPhoto(null);
    setMemo("");
    setSavingLocally(true);
    setToast("端末に一時保存中…");
    try {
      const imageBlob = await fetch(photoDataUrl).then(response => response.blob());
      const imageData = await imageBlob.arrayBuffer();
      if (imageData.byteLength < 1000) throw new Error("captured image is empty");
      const queuedPhoto: QueuedPhoto = {
        id: queueId,
        userId: user.id,
        workItemId: workInfo.workId,
        siteId,
        memberName: profile.display_name,
        memo: queuedMemo,
        imagePath: `${user.id}/${queueId}.jpg`,
        imageData,
        capturedAt: new Date().toISOString(),
        status: "pending",
        attempts: 0,
      };
      await saveQueuedPhoto(queuedPhoto);
      await refreshQueueStatus(user.id);
      setToast(navigator.onLine ? "送信待ちに追加しました" : "オフラインで一時保存しました");
      window.setTimeout(() => setToast(""), 2400);
      void syncQueuedPhotos();
    } catch {
      setPendingPhoto(photoDataUrl);
      setMemo(queuedMemo);
      setToast("端末に保存できませんでした");
    } finally {
      setSavingLocally(false);
    }
  }

  const allPhotos = capturedPhotos;

  const filtered = useMemo(() => allPhotos.filter(p =>
    (filters.work === "すべて" || p.work === filters.work) &&
    (filters.site === "すべて" || p.site === filters.site) &&
    (filters.member === "すべて" || p.member === filters.member)
  ), [filters, allPhotos]);

  function togglePhotoSelection(photoId: PhotoItem["id"]) {
    setSelectedPhotoIds(current => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
    setBulkDownloadError("");
  }

  function cancelPhotoSelection() {
    setSelectionMode(false);
    setSelectedPhotoIds(new Set());
    setBulkDownloadError("");
  }

  function selectAllFilteredPhotos() {
    setSelectedPhotoIds(new Set(filtered.map(photo => photo.id)));
    setBulkDownloadError("");
  }

  async function downloadSelectedPhotos() {
    const selectedPhotos = allPhotos.filter(photo => selectedPhotoIds.has(photo.id));
    if (!selectedPhotos.length || bulkDownloading) return;
    setBulkDownloading(true);
    setBulkDownloadError("");
    try {
      const files: Record<string, Uint8Array> = {};
      await Promise.all(selectedPhotos.map(async (photo, index) => {
        const response = await fetch(photo.image);
        if (!response.ok) throw new Error("photo download failed");
        const safeSite = photo.site.replace(/[\\/:*?"<>|]/g, "_");
        const safeTime = photo.time.replace(/[^\d]/g, "").slice(0, 12);
        const sequence = String(index + 1).padStart(2, "0");
        files[`${safeSite}_${safeTime}_${sequence}.jpg`] = new Uint8Array(await response.arrayBuffer());
      }));
      const archive = await new Promise<Uint8Array>((resolve, reject) => {
        zip(files, { level:0 }, (error, data) => error ? reject(error) : resolve(data));
      });
      const objectUrl = URL.createObjectURL(new Blob([archive as BlobPart], { type:"application/zip" }));
      const link = document.createElement("a");
      const today = formatLocalDateTime(new Date()).slice(0, 10).replaceAll("/", "-");
      link.href = objectUrl;
      link.download = `現場写真_${today}_${selectedPhotos.length}枚.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      cancelPhotoSelection();
    } catch {
      setBulkDownloadError("一括ダウンロードに失敗しました。画面を更新して、もう一度お試しください。");
    } finally {
      setBulkDownloading(false);
    }
  }

  if (authLoading) return <div className="auth-loading">読み込み中…</div>;
  if (!user) return <LoginScreen />;
  if (passwordRecovery || user?.user_metadata?.must_set_password) return <ChangePasswordScreen onDone={() => setPasswordRecovery(false)} />;

  const displayName = profile?.display_name ?? user.email?.split("@")[0] ?? "スタッフ";
  const avatarText = displayName.slice(0, 1);
  const desktopPage = {
    photos:{ eyebrow:"PHOTO LIBRARY", title:"写真一覧" },
    categories:{ eyebrow:"WORK SETTINGS", title:"作業項目・現場管理" },
    members:{ eyebrow:"MEMBER MANAGEMENT", title:"メンバー管理" },
  }[desktopSection];

  return <>
    <div className="mobile-app">
      <main className="mobile-main">
        <header className="mobile-header"><span className="eyebrow">FIELD NOTE</span><h1>{mobileTab === "capture" ? "撮影" : "写真一覧"}</h1><button className="avatar" aria-label="ログアウト" onClick={() => supabase.auth.signOut()}>{avatarText}</button></header>
        {mobileTab === "capture" ? <div className="capture-view">
          <div className="preview">
            <video ref={videoRef} autoPlay playsInline muted />
            {cameraError && <div className="camera-fallback"><img src={photos[0].image} alt="現場のプレビュー"/><div className="camera-message"><span>カメラを利用できません</span><button onClick={startCamera}>もう一度試す</button></div></div>}
          </div>
          <section className="capture-fields">
            <label className="field-card"><span>作業項目</span><select value={work} onChange={e => changeWork(e.target.value)}>{Object.keys(categoryData).map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="field-card site-field"><span>現場選択</span><select value={site} onChange={e => changeSite(e.target.value)}>{(categoryData[work] ?? []).map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="memo-card"><span>メモ <small>任意</small></span><textarea maxLength={200} value={memo} onChange={e => setMemo(e.target.value)} placeholder="作業内容や気になる点を入力"/><b>{memo.length}/200</b></label>
          </section>
          {(queueStatus.pending > 0 || queueStatus.sending > 0 || queueStatus.failed > 0 || syncNotice) && <div className={`sync-status ${queueStatus.pending > 0 || queueStatus.failed > 0 ? "waiting" : ""}`} role="status"><span>{queueStatus.sending > 0 ? `送信中 ${queueStatus.sending}件` : queueStatus.failed > 0 ? `送信できない写真 ${queueStatus.failed}件` : queueStatus.pending > 0 ? syncNotice || `未送信 ${queueStatus.pending}件` : syncNotice}</span>{queueStatus.failed > 0 && queueStatus.sending === 0 && <button type="button" onClick={retryFailedPhotos}>再送</button>}{(queueStatus.pending > 0 || queueStatus.failed > 0) && queueStatus.sending === 0 && <button type="button" onClick={discardQueuedPhotos}>削除</button>}</div>}
          <button className="capture-button" onClick={capture} disabled={!work || !site || savingLocally} aria-label="写真を撮影"><span>▣</span></button>
          {toast && <div className="toast" role="status">{toast}</div>}
        </div> : <MobilePhotos photos={allPhotos} onSelect={setSelected}/>} 
      </main>
      <nav className="bottom-nav" aria-label="メインナビゲーション">
        <button className={mobileTab === "capture" ? "active" : ""} onClick={() => setMobileTab("capture")}><Icon>●</Icon>撮影</button>
        <button className={mobileTab === "photos" ? "active" : ""} onClick={() => setMobileTab("photos")}><Icon>▧</Icon>写真一覧</button>
      </nav>
    </div>

    {profile?.role === "admin" ? <div className="desktop-app">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">▣</div><span>現場写真共有</span></div>
        <nav><button className={desktopSection === "photos" ? "active" : ""} onClick={() => setDesktopSection("photos")}><Icon>▧</Icon>写真一覧</button><button className={desktopSection === "categories" ? "active" : ""} onClick={() => setDesktopSection("categories")}><Icon>☷</Icon>項目の追加</button><button className={desktopSection === "members" ? "active" : ""} onClick={() => setDesktopSection("members")}><Icon>♙</Icon>メンバー</button></nav>
        <div className="account-menu-wrap" ref={accountMenuRef}>
          {accountMenuOpen && <div className="account-popover"><div className="account-popover-head"><div className="profile-avatar">{avatarText}</div><div><b>{displayName}</b><small>{user.email}</small></div><span>管理者</span></div><div className="account-popover-actions"><button onClick={() => { setAccountMenuOpen(false); setAccountPasswordOpen(true); }}><span>⌘</span>パスワードを変更</button><button className="logout-action" onClick={() => supabase.auth.signOut()}><span>↪</span>ログアウトする</button></div></div>}
          <button className={`profile ${accountMenuOpen ? "open" : ""}`} onClick={() => setAccountMenuOpen(open => !open)} aria-expanded={accountMenuOpen} aria-haspopup="menu"><div className="profile-avatar">{avatarText}</div><div><b>{displayName}</b><small>管理者・アカウントメニュー</small></div><span>{accountMenuOpen ? "⌃" : "⌄"}</span></button>
        </div>
      </aside>
      <main className="desktop-main">
        <header className="page-head"><div><span className="eyebrow">{desktopPage.eyebrow}</span><h1>{desktopPage.title}</h1></div>{desktopSection === "photos" && <button className="refresh" onClick={() => location.reload()}>↻ <span>更新</span></button>}</header>
        {desktopSection === "photos" ? <section className="workspace">
          <div className="filters">
            <label>作業項目<select value={filters.work} onChange={e => setFilters({...filters, work:e.target.value})}><option>すべて</option>{Object.keys(categoryData).map(x => <option key={x}>{x}</option>)}</select></label>
            <label>現場名<select value={filters.site} onChange={e => setFilters({...filters, site:e.target.value})}><option>すべて</option>{[...new Set(allPhotos.map(p => p.site))].map(x => <option key={x}>{x}</option>)}</select></label>
            <label>メンバー<select value={filters.member} onChange={e => setFilters({...filters, member:e.target.value})}><option>すべて</option>{[...new Set(allPhotos.map(p => p.member))].map(x => <option key={x}>{x}</option>)}</select></label>
            <button className="clear" onClick={() => setFilters({work:"すべて",site:"すべて",member:"すべて"})}>クリア</button>
          </div>
          <div className="sites"><span>現場一覧</span><div><button className={filters.site === "すべて" ? "active" : ""} onClick={() => setFilters({...filters,site:"すべて"})}>すべて</button>{[...new Set(allPhotos.map(p => p.site))].map(x => <button key={x} className={filters.site === x ? "active" : ""} onClick={() => setFilters({...filters,site:x})}>{x}</button>)}</div></div>
          <div className={`result-bar ${selectionMode ? "selection-active" : ""}`}><p>{selectionMode ? <><b>{selectedPhotoIds.size}</b> 枚選択中</> : <><b>{filtered.length}</b> 件の写真</>}</p>{selectionMode ? <div className="selection-actions"><button type="button" onClick={selectAllFilteredPhotos} disabled={!filtered.length}>すべて選択</button><button type="button" onClick={() => setSelectedPhotoIds(new Set())} disabled={!selectedPhotoIds.size}>選択を解除</button><button type="button" className="bulk-download" onClick={downloadSelectedPhotos} disabled={!selectedPhotoIds.size || bulkDownloading}>{bulkDownloading ? "ZIPを作成中…" : "まとめてダウンロード"}</button><button type="button" onClick={cancelPhotoSelection}>キャンセル</button></div> : <button type="button" className="start-selection" onClick={() => setSelectionMode(true)} disabled={!filtered.length}>写真を選択</button>}</div>
          {bulkDownloadError && <p className="bulk-download-error" role="alert">{bulkDownloadError}</p>}
          <div className={`photo-grid ${selectionMode ? "is-selecting" : ""}`}>{filtered.map(p => <PhotoCard key={p.id} photo={p} selected={selectedPhotoIds.has(p.id)} selectionMode={selectionMode} onClick={() => selectionMode ? togglePhotoSelection(p.id) : setSelected(p)}/>)}</div>
          {!filtered.length && <div className="empty">条件に一致する写真はありません</div>}
        </section> : desktopSection === "categories" ? <WorkCategoryManager data={categoryData} onChange={updateMasterData}/> : <MemberManager currentUserId={user.id}/>}
      </main>
    </div> : profile && <div className="desktop-restricted"><div className="restricted-panel"><div className="restricted-icon">▣</div><span>STAFF MOBILE APP</span><h1>PC版は管理者専用です</h1><p>撮影と写真確認はスマートフォンからご利用ください。</p><button onClick={() => supabase.auth.signOut()}>ログアウト</button></div></div>}
    {selected && <PhotoModal photo={selected} onClose={() => setSelected(null)}/>} 
    {pendingPhoto && <CaptureReview image={pendingPhoto} onSave={savePhoto} onRetake={() => setPendingPhoto(null)}/>} 
    {accountPasswordOpen && <AccountPasswordModal onClose={() => setAccountPasswordOpen(false)}/>}
  </>;
}

function AccountPasswordModal({ onClose }: { onClose:()=>void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("パスワードは8文字以上で入力してください");
      return;
    }
    if (password !== confirmation) {
      setMessage("確認用パスワードが一致しません");
      return;
    }
    setSubmitting(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setMessage("パスワードを変更できませんでした。もう一度お試しください。");
      return;
    }
    setMessage("✓ パスワードを変更しました");
    window.setTimeout(onClose, 1200);
  }

  return <div className="account-password-backdrop" onMouseDown={() => !submitting && onClose()}><form className="account-password-dialog" onSubmit={changePassword} onMouseDown={event => event.stopPropagation()}><div className="account-password-head"><div><small>ACCOUNT SECURITY</small><h2>パスワードを変更</h2></div><button type="button" onClick={onClose}>×</button></div><p>次回のログインから新しいパスワードを使用してください。</p><label>新しいパスワード<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} placeholder="8文字以上"/></label><label>新しいパスワード（確認）<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="もう一度入力"/></label>{message && <div className={message.startsWith("✓") ? "account-password-success" : "account-password-error"} role="status">{message}</div>}<div className="account-password-actions"><button type="button" onClick={onClose}>キャンセル</button><button type="submit" disabled={submitting}>{submitting ? "変更中…" : "パスワードを変更"}</button></div></form></div>;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) setMessage("メールアドレスまたはパスワードを確認してください");
  }

  async function resetPassword() {
    if (!email) {
      setMessage("先にメールアドレスを入力してください");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:window.location.origin,
    });
    setMessage(error ? "再設定メールを送信できませんでした" : "パスワード再設定メールを送信しました");
  }

  return <main className="login-page">
    <section className="login-panel">
      <div className="login-brand"><span>▣</span><div><small>FIELD NOTE</small><h1>現場写真共有</h1></div></div>
      <p>スタッフアカウントでログインしてください</p>
      <form onSubmit={login}>
        <label>メールアドレス<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com"/></label>
        <label>パスワード<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="パスワード"/></label>
        {message && <span className="login-error" role="alert">{message}</span>}
        <button disabled={submitting}>{submitting ? "ログイン中…" : "ログイン"}</button>
      </form>
      <button className="reset-link" onClick={resetPassword}>パスワードを忘れた方</button>
      <small className="login-help">アカウントがない場合は管理者へ連絡してください</small>
    </section>
  </main>;
}

function ChangePasswordScreen({ onDone }: { onDone:()=>void }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("8文字以上で入力してください");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password, data:{ must_set_password:false } });
    if (error) setMessage("パスワードを更新できませんでした");
    else onDone();
  }

  return <main className="login-page"><section className="login-panel">
    <div className="login-brand"><span>▣</span><div><small>FIELD NOTE</small><h1>新しいパスワード</h1></div></div>
    <p>今後ログインに使用するパスワードを設定してください</p>
    <form onSubmit={save}>
      <label>新しいパスワード<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)}/></label>
      {message && <span className="login-error" role="alert">{message}</span>}
      <button>パスワードを保存</button>
    </form>
  </section></main>;
}

function MemberManager({ currentUserId }: { currentUserId:string }) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<{ mode:"add"|"edit"; id?:string; displayName:string; email:string; role:"admin"|"staff" } | null>(null);

  useEffect(() => {
    void loadMembers();
  }, []);

  async function adminRequest(method: "GET"|"POST"|"PATCH", body?:Record<string,unknown>) {
    const { data:{ session } } = await supabase.auth.getSession();
    if (!session) throw new Error("ログインし直してください");
    const response = await fetch("/api/admin/members", {
      method,
      headers:{
        Authorization:`Bearer ${session.access_token}`,
        ...(body ? { "Content-Type":"application/json" } : {}),
      },
      body:body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "処理に失敗しました");
    return result;
  }

  async function loadMembers() {
    setLoading(true);
    setError("");
    try {
      const result = await adminRequest("GET");
      setMembers(result.members);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "メンバーを読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3000);
  }

  async function saveMember(event: React.FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setSubmitting(true);
    setError("");
    try {
      if (editor.mode === "add") {
        await adminRequest("POST", {
          displayName:editor.displayName,
          email:editor.email,
          role:editor.role,
        });
        flash("招待メールを送信しました");
      } else {
        await adminRequest("PATCH", {
          id:editor.id,
          action:"edit",
          displayName:editor.displayName,
          role:editor.role,
        });
        flash("メンバー情報を更新しました");
      }
      setEditor(null);
      await loadMembers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存できませんでした");
    } finally {
      setSubmitting(false);
    }
  }

  async function runMemberAction(member: MemberItem, action:"stop"|"activate"|"password_reset") {
    const actionLabel = action === "stop" ? "利用停止" : action === "activate" ? "利用再開" : "設定メール送信";
    if (action !== "password_reset" && !window.confirm(`${member.displayName}さんを${actionLabel}にしますか？`)) return;
    setSubmitting(true);
    setError("");
    try {
      await adminRequest("PATCH", { id:member.id, email:member.email, action });
      flash(action === "password_reset" ? "設定メールを送信しました" : `${actionLabel}にしました`);
      await loadMembers();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  function formatMemberDate(value: string | null) {
    if (!value) return "まだありません";
    return formatLocalDateTime(new Date(value));
  }

  return <section className="member-workspace">
    <div className="member-toolbar"><div><b>登録メンバー</b><p>スタッフの招待、権限変更、利用停止を管理できます。</p></div><button onClick={() => setEditor({ mode:"add", displayName:"", email:"", role:"staff" })}>＋ メンバーを追加</button></div>
    {message && <div className="member-success" role="status">{message}</div>}
    {error && <div className="member-error" role="alert">{error}</div>}
    <div className="member-summary"><div><span>登録</span><b>{members.length}</b></div><div><span>利用中</span><b>{members.filter(member => member.status === "active").length}</b></div><div><span>招待中</span><b>{members.filter(member => member.status === "invited").length}</b></div><div><span>利用停止</span><b>{members.filter(member => member.status === "stopped").length}</b></div></div>
    <div className="member-table-wrap">
      {loading ? <div className="member-loading">読み込み中…</div> : <table className="member-table"><thead><tr><th>メンバー</th><th>権限</th><th>状態</th><th>最終ログイン</th><th>操作</th></tr></thead><tbody>{members.map(member => <tr key={member.id}><td><div className="member-identity"><span>{member.displayName.slice(0, 1) || "?"}</span><div><b>{member.displayName}{member.id === currentUserId && <em>自分</em>}</b><small>{member.email}</small></div></div></td><td><span className={`role-badge ${member.role}`}>{member.role === "admin" ? "管理者" : "スタッフ"}</span></td><td><span className={`member-status ${member.status}`}>{member.status === "active" ? "利用中" : member.status === "invited" ? "招待中" : "利用停止"}</span></td><td>{formatMemberDate(member.lastSignInAt)}</td><td><div className="member-actions"><button onClick={() => setEditor({ mode:"edit", id:member.id, displayName:member.displayName, email:member.email, role:member.role })}>編集</button><button onClick={() => runMemberAction(member, "password_reset")}>{member.status === "invited" ? "設定メールを再送" : "パスワード再設定"}</button>{member.status === "stopped" ? <button className="activate-member" onClick={() => runMemberAction(member, "activate")}>利用再開</button> : <button className="stop-member" disabled={member.id === currentUserId} onClick={() => runMemberAction(member, "stop")}>利用停止</button>}</div></td></tr>)}</tbody></table>}
    </div>
    {editor && <div className="member-editor-backdrop" onMouseDown={() => !submitting && setEditor(null)}><form className="member-editor" onSubmit={saveMember} onMouseDown={event => event.stopPropagation()}><div className="member-editor-head"><div><small>{editor.mode === "add" ? "NEW MEMBER" : "EDIT MEMBER"}</small><h2>{editor.mode === "add" ? "メンバーを追加" : "メンバーを編集"}</h2></div><button type="button" onClick={() => setEditor(null)}>×</button></div><label>名前<input required value={editor.displayName} onChange={event => setEditor({ ...editor, displayName:event.target.value })} placeholder="例：山田 太郎"/></label><label>メールアドレス<input type="email" required disabled={editor.mode === "edit"} value={editor.email} onChange={event => setEditor({ ...editor, email:event.target.value })} placeholder="staff@example.com"/></label><label>権限<select value={editor.role} onChange={event => setEditor({ ...editor, role:event.target.value as "admin"|"staff" })}><option value="staff">スタッフ</option><option value="admin">管理者</option></select></label>{editor.mode === "add" && <p>追加すると、本人へパスワード設定用の招待メールが届きます。</p>}<div className="member-editor-actions"><button type="button" onClick={() => setEditor(null)}>キャンセル</button><button type="submit" disabled={submitting}>{submitting ? "処理中…" : editor.mode === "add" ? "招待メールを送信" : "変更を保存"}</button></div></form></div>}
  </section>;
}

function WorkCategoryManager({ data, onChange }: { data:Record<string,string[]>, onChange:(next:Record<string,string[]>)=>void }) {
  const [selectedCategory, setSelectedCategory] = useState(Object.keys(data)[0] ?? "");
  const [categoryName, setCategoryName] = useState(selectedCategory);
  const [newCategory, setNewCategory] = useState("");
  const [newSite, setNewSite] = useState("");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<
    { type:"category"; name:string } | { type:"site"; name:string; index:number } | null
  >(null);

  useEffect(() => {
    const available = Object.keys(data);
    const nextSelected = data[selectedCategory] ? selectedCategory : (available[0] ?? "");
    if (nextSelected !== selectedCategory) setSelectedCategory(nextSelected);
    setCategoryName(nextSelected);
  }, [data, selectedCategory]);

  function flash(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(""), 1800);
  }

  function addCategory() {
    const name = newCategory.trim();
    if (!name || data[name]) return;
    onChange({ ...data, [name]: ["それ以外"] });
    setSelectedCategory(name);
    setCategoryName(name);
    setNewCategory("");
    flash("作業項目を追加しました");
  }

  function saveCategoryName() {
    const name = categoryName.trim();
    if (!name || !selectedCategory || (name !== selectedCategory && data[name])) return;
    const next = Object.fromEntries(Object.entries(data).map(([key, sites]) => [key === selectedCategory ? name : key, sites]));
    onChange(next);
    setSelectedCategory(name);
    flash("作業項目名を保存しました");
  }

  function removeCategory() {
    if (!selectedCategory) return;
    setDeleteTarget({ type:"category", name:selectedCategory });
  }

  function updateSite(index: number, value: string) {
    const sites = [...(data[selectedCategory] ?? [])];
    sites[index] = value;
    onChange({ ...data, [selectedCategory]: sites });
  }

  function addSite() {
    const name = newSite.trim();
    const current = data[selectedCategory] ?? [];
    if (!name || !selectedCategory || current.includes(name)) return;
    const regularSites = current.filter(site => site !== "それ以外");
    const hasOther = current.includes("それ以外");
    onChange({ ...data, [selectedCategory]: [...regularSites, name, ...(hasOther ? ["それ以外"] : [])] });
    setNewSite("");
    flash("現場を追加しました");
  }

  function removeSite(index: number) {
    const siteName = data[selectedCategory]?.[index];
    if (!siteName) return;
    setDeleteTarget({ type:"site", name:siteName, index });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "category") {
      const next = Object.fromEntries(Object.entries(data).filter(([key]) => key !== deleteTarget.name));
      onChange(next);
      flash("作業項目を削除しました");
    } else {
      const sites = (data[selectedCategory] ?? []).filter((_, siteIndex) => siteIndex !== deleteTarget.index);
      onChange({ ...data, [selectedCategory]: sites });
      flash("現場を削除しました");
    }
    setDeleteTarget(null);
  }

  return <><section className="master-workspace">
    <div className="master-intro"><div><b>作業項目と現場を編集</b><p>作業項目を選ぶと、その中に登録されている現場を編集できます。</p></div>{message && <span>{message}</span>}</div>
    <div className="master-layout">
      <aside className="category-panel">
        <div className="panel-title"><div><small>親項目</small><h2>作業項目</h2></div><em>{Object.keys(data).length}件</em></div>
        <div className="add-row"><input value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => e.key === "Enter" && addCategory()} placeholder="新しい作業項目"/><button onClick={addCategory}>追加</button></div>
        <div className="category-list">{Object.keys(data).map(name => <button key={name} className={selectedCategory === name ? "active" : ""} onClick={() => setSelectedCategory(name)}><span>{name}</span><small>{data[name].length}現場</small><b>›</b></button>)}</div>
      </aside>
      <div className="site-panel">
        {selectedCategory ? <>
          <div className="editor-head"><div><small>選択中の作業項目</small><div className="category-name-edit"><input value={categoryName} onChange={e => setCategoryName(e.target.value)}/><button onClick={saveCategoryName}>名前を保存</button></div></div><button className="danger-link" onClick={removeCategory}>作業項目を削除</button></div>
          <div className="child-title"><div><small>子項目</small><h3>現場選択</h3><p>「{selectedCategory}」を選んだときに表示される現場です。</p></div><em>{(data[selectedCategory] ?? []).length}件</em></div>
          <div className="add-site-row"><input value={newSite} onChange={e => setNewSite(e.target.value)} placeholder="新しい現場名を入力"/><button type="button" onClick={addSite}>＋ 現場を追加</button></div>
          <div className="site-list">{(data[selectedCategory] ?? []).map((siteName,index) => <div className="site-edit-row" key={`${selectedCategory}-${index}`}><span className="drag-mark">⋮⋮</span><input value={siteName} onChange={e => updateSite(index,e.target.value)}/><span className={siteName === "それ以外" ? "other-badge" : "site-badge"}>{siteName === "それ以外" ? "共通" : "有効"}</span><button onClick={() => removeSite(index)} aria-label={`${siteName}を削除`}>削除</button></div>)}</div>
        </> : <div className="master-empty">作業項目を追加してください</div>}
      </div>
    </div>
  </section>
  {deleteTarget && <div className="confirm-backdrop" role="presentation" onMouseDown={() => setDeleteTarget(null)}>
    <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" onMouseDown={event => event.stopPropagation()}>
      <div className="confirm-icon">!</div>
      <h2 id="delete-dialog-title">{deleteTarget.type === "category" ? "作業項目を削除しますか？" : "現場を削除しますか？"}</h2>
      <p>「{deleteTarget.name}」を削除します。{deleteTarget.type === "category" ? "登録されている現場も選択肢から削除されます。" : "過去に保存した写真には現場名が残ります。"}</p>
      <div className="confirm-actions"><button type="button" onClick={() => setDeleteTarget(null)}>キャンセル</button><button type="button" className="confirm-delete" onClick={confirmDelete}>削除する</button></div>
    </section>
  </div>}
  </>;
}

function CaptureReview({ image, onSave, onRetake }: { image:string, onSave:()=>void, onRetake:()=>void }) {
  return <div className="capture-review" role="dialog" aria-modal="true" aria-labelledby="review-title">
    <div className="review-panel">
      <header><span>撮影した写真</span><h2 id="review-title">この写真を保存しますか？</h2></header>
      <img src={image} alt="撮影した写真の確認"/>
      <div className="review-actions"><button className="retake-button" onClick={onRetake}>撮り直す</button><button className="save-button" onClick={onSave}>保存する</button></div>
    </div>
  </div>;
}

function PhotoCard({ photo, onClick, selectionMode=false, selected=false }: { photo:PhotoItem, onClick:()=>void, selectionMode?:boolean, selected?:boolean }) {
  return <button className={`photo-card ${selected ? "selected" : ""}`} onClick={onClick} aria-pressed={selectionMode ? selected : undefined}>{selectionMode && <span className="photo-check" aria-hidden="true">{selected ? "✓" : ""}</span>}<img src={photo.image} alt={`${photo.site}の${photo.work}`}/><div><b>{photo.site}</b><span>{photo.work}</span><small>{photo.member}</small><footer><time>{photo.time}</time>{photo.comments > 0 && <em>♡ {photo.comments}</em>}</footer></div></button>;
}

function MobilePhotos({ photos: photoItems, onSelect }: { photos:PhotoItem[], onSelect:(p:PhotoItem)=>void }) {
  const today = formatLocalDateTime(new Date()).slice(0, 10);
  const todayPhotos = photoItems.filter(photo => photo.time.slice(0, 10) === today);
  return <section className="mobile-gallery"><div className="mobile-summary"><b>今日の写真</b><span>{todayPhotos.length}件</span></div>{todayPhotos.map(p => <PhotoCard key={p.id} photo={p} onClick={() => onSelect(p)}/>)}{todayPhotos.length === 0 && <div className="mobile-empty"><span>▧</span><b>今日の写真はまだありません</b><small>撮影して保存すると、ここに表示されます</small></div>}</section>;
}

function PhotoModal({ photo, onClose }: { photo:PhotoItem, onClose:()=>void }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  async function downloadPhoto() {
    setDownloading(true);
    setDownloadError("");
    try {
      const response = await fetch(photo.image);
      if (!response.ok) throw new Error("download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeSite = photo.site.replace(/[\\/:*?"<>|]/g, "_");
      const safeTime = photo.time.replace(/[^\d]/g, "").slice(0, 12);
      link.href = objectUrl;
      link.download = `${safeSite}_${safeTime || photo.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setDownloadError("ダウンロードできませんでした。画面を更新して、もう一度お試しください。");
    } finally {
      setDownloading(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><article className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><img src={photo.image} alt={`${photo.site}の写真`}/><div className="modal-info"><span className="status">保存済み</span><h2>{photo.site}</h2><dl><div><dt>作業項目</dt><dd>{photo.work}</dd></div><div><dt>撮影者</dt><dd>{photo.member}</dd></div><div><dt>撮影日時</dt><dd>{photo.time}</dd></div><div><dt>メモ</dt><dd>{photo.memo || "なし"}</dd></div></dl><button className="download desktop-download" onClick={downloadPhoto} disabled={downloading}>{downloading ? "ダウンロード中…" : "写真をダウンロード"}</button>{downloadError && <p className="download-error" role="alert">{downloadError}</p>}</div></article></div>;
}
