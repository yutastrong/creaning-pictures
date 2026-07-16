"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const photos = [
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

export default function Home() {
  const [mobileTab, setMobileTab] = useState<"capture" | "photos">("capture");
  const [desktopSection, setDesktopSection] = useState<"photos" | "categories">("photos");
  const [categoryData, setCategoryData] = useState<Record<string, string[]>>(siteMap);
  const [work, setWork] = useState("トイレ清掃");
  const [site, setSite] = useState("第二小学校");
  const [memo, setMemo] = useState("");
  const [toast, setToast] = useState("");
  const [cameraError, setCameraError] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<(typeof photos)[number][]>([]);
  const [filters, setFilters] = useState({ work: "すべて", site: "すべて", member: "すべて" });
  const [selected, setSelected] = useState<(typeof photos)[number] | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const savedWork = localStorage.getItem("field-work");
    const savedSite = localStorage.getItem("field-site");
    const savedMasterData = localStorage.getItem("field-master-data");
    if (savedWork && siteMap[savedWork]) setWork(savedWork);
    if (savedSite) setSite(savedSite);
    if (savedMasterData) {
      try { setCategoryData(JSON.parse(savedMasterData)); } catch { /* use initial master data */ }
    }
    return stopCamera;
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const handleViewportChange = () => {
      if (mobileQuery.matches && mobileTab === "capture") startCamera();
      else stopCamera();
    };
    handleViewportChange();
    mobileQuery.addEventListener("change", handleViewportChange);
    return () => mobileQuery.removeEventListener("change", handleViewportChange);
  }, [mobileTab]);

  useEffect(() => {
    const reconnectCamera = () => {
      if (document.visibilityState === "visible" && mobileTab === "capture" && window.matchMedia("(max-width: 760px)").matches) startCamera();
    };
    document.addEventListener("visibilitychange", reconnectCamera);
    return () => document.removeEventListener("visibilitychange", reconnectCamera);
  }, [mobileTab]);

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
    localStorage.setItem("field-master-data", JSON.stringify(next));
    const categoryNames = Object.keys(next);
    if (!next[work]) {
      const nextWork = categoryNames[0] ?? "";
      setWork(nextWork);
      setSite(next[nextWork]?.[0] ?? "");
    } else if (!next[work].includes(site)) {
      setSite(next[work][0] ?? "");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setPendingPhoto(photos[0].image);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 900;
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
    setPendingPhoto(canvas.toDataURL("image/jpeg", 0.82));
  }

  function savePhoto() {
    if (!pendingPhoto) return;
    const newPhoto = {
      id: Date.now(),
      site,
      work,
      member: "山田 太郎",
      time: formatLocalDateTime(new Date()),
      memo,
      comments: 0,
      image: pendingPhoto,
    };
    setCapturedPhotos(current => [newPhoto, ...current]);
    setPendingPhoto(null);
    setToast("保存中…");
    setTimeout(() => { setToast("✓ 保存しました"); setMemo(""); setTimeout(() => setToast(""), 2400); }, 700);
  }

  const allPhotos = useMemo(() => [...capturedPhotos, ...photos], [capturedPhotos]);

  const filtered = useMemo(() => allPhotos.filter(p =>
    (filters.work === "すべて" || p.work === filters.work) &&
    (filters.site === "すべて" || p.site === filters.site) &&
    (filters.member === "すべて" || p.member === filters.member)
  ), [filters, allPhotos]);

  return <>
    <div className="mobile-app">
      <main className="mobile-main">
        <header className="mobile-header"><span className="eyebrow">FIELD NOTE</span><h1>{mobileTab === "capture" ? "撮影" : "写真一覧"}</h1><button className="avatar" aria-label="プロフィール">山</button></header>
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
          <button className="capture-button" onClick={capture} disabled={!work || !site} aria-label="写真を撮影"><span>▣</span></button>
          {toast && <div className="toast" role="status">{toast}</div>}
        </div> : <MobilePhotos photos={allPhotos} onSelect={setSelected}/>} 
      </main>
      <nav className="bottom-nav" aria-label="メインナビゲーション">
        <button className={mobileTab === "capture" ? "active" : ""} onClick={() => setMobileTab("capture")}><Icon>●</Icon>撮影</button>
        <button className={mobileTab === "photos" ? "active" : ""} onClick={() => setMobileTab("photos")}><Icon>▧</Icon>写真一覧</button>
      </nav>
    </div>

    <div className="desktop-app">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">▣</div><span>現場写真共有</span></div>
        <nav><button className={desktopSection === "photos" ? "active" : ""} onClick={() => setDesktopSection("photos")}><Icon>▧</Icon>写真一覧</button><button className={desktopSection === "categories" ? "active" : ""} onClick={() => setDesktopSection("categories")}><Icon>☷</Icon>項目の追加</button><button><Icon>♙</Icon>メンバー</button></nav>
        <div className="profile"><div className="profile-avatar">山</div><div><b>山田 太郎</b><small>事務所スタッフ</small></div><span>⌄</span></div>
      </aside>
      <main className="desktop-main">
        <header className="page-head"><div><span className="eyebrow">{desktopSection === "photos" ? "PHOTO LIBRARY" : "WORK SETTINGS"}</span><h1>{desktopSection === "photos" ? "写真一覧" : "作業項目・現場管理"}</h1></div>{desktopSection === "photos" && <button className="refresh" onClick={() => location.reload()}>↻ <span>更新</span></button>}</header>
        {desktopSection === "photos" ? <section className="workspace">
          <div className="filters">
            <label>作業項目<select value={filters.work} onChange={e => setFilters({...filters, work:e.target.value})}><option>すべて</option>{Object.keys(siteMap).map(x => <option key={x}>{x}</option>)}</select></label>
            <label>現場名<select value={filters.site} onChange={e => setFilters({...filters, site:e.target.value})}><option>すべて</option>{[...new Set(photos.map(p => p.site))].map(x => <option key={x}>{x}</option>)}</select></label>
            <label>メンバー<select value={filters.member} onChange={e => setFilters({...filters, member:e.target.value})}><option>すべて</option>{[...new Set(photos.map(p => p.member))].map(x => <option key={x}>{x}</option>)}</select></label>
            <label>期間<div className="date-range">2024/06/01 〜 2024/06/15 <span>▦</span></div></label>
            <button className="clear" onClick={() => setFilters({work:"すべて",site:"すべて",member:"すべて"})}>クリア</button>
          </div>
          <div className="sites"><span>現場一覧</span><div><button className={filters.site === "すべて" ? "active" : ""} onClick={() => setFilters({...filters,site:"すべて"})}>すべて</button>{[...new Set(photos.map(p => p.site))].map(x => <button key={x} className={filters.site === x ? "active" : ""} onClick={() => setFilters({...filters,site:x})}>{x}</button>)}</div></div>
          <div className="result-bar"><p><b>{filtered.length}</b> 件の写真</p><div><button className="view-active">▦</button><button>☷</button><select><option>撮影日時（新しい順）</option><option>撮影日時（古い順）</option></select></div></div>
          <div className="photo-grid">{filtered.map(p => <PhotoCard key={p.id} photo={p} onClick={() => setSelected(p)}/>)}</div>
          {!filtered.length && <div className="empty">条件に一致する写真はありません</div>}
        </section> : <WorkCategoryManager data={categoryData} onChange={updateMasterData}/>} 
      </main>
    </div>
    {selected && <PhotoModal photo={selected} onClose={() => setSelected(null)}/>} 
    {pendingPhoto && <CaptureReview image={pendingPhoto} onSave={savePhoto} onRetake={() => setPendingPhoto(null)}/>} 
  </>;
}

function WorkCategoryManager({ data, onChange }: { data:Record<string,string[]>, onChange:(next:Record<string,string[]>)=>void }) {
  const [selectedCategory, setSelectedCategory] = useState(Object.keys(data)[0] ?? "");
  const [categoryName, setCategoryName] = useState(selectedCategory);
  const [newCategory, setNewCategory] = useState("");
  const [newSite, setNewSite] = useState("");
  const [message, setMessage] = useState("");

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
    if (!selectedCategory || !window.confirm(`「${selectedCategory}」と、その現場を削除しますか？`)) return;
    const next = Object.fromEntries(Object.entries(data).filter(([key]) => key !== selectedCategory));
    onChange(next);
    flash("作業項目を削除しました");
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
    const sites = (data[selectedCategory] ?? []).filter((_, siteIndex) => siteIndex !== index);
    onChange({ ...data, [selectedCategory]: sites });
    flash("現場を削除しました");
  }

  return <section className="master-workspace">
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
          <div className="add-site-row"><input value={newSite} onChange={e => setNewSite(e.target.value)} onKeyDown={e => e.key === "Enter" && addSite()} placeholder="新しい現場名を入力"/><button onClick={addSite}>＋ 現場を追加</button></div>
          <div className="site-list">{(data[selectedCategory] ?? []).map((siteName,index) => <div className="site-edit-row" key={`${selectedCategory}-${index}`}><span className="drag-mark">⋮⋮</span><input value={siteName} onChange={e => updateSite(index,e.target.value)}/><span className={siteName === "それ以外" ? "other-badge" : "site-badge"}>{siteName === "それ以外" ? "共通" : "有効"}</span><button onClick={() => removeSite(index)} aria-label={`${siteName}を削除`}>削除</button></div>)}</div>
        </> : <div className="master-empty">作業項目を追加してください</div>}
      </div>
    </div>
  </section>;
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

function PhotoCard({ photo, onClick }: { photo:(typeof photos)[number], onClick:()=>void }) {
  return <button className="photo-card" onClick={onClick}><img src={photo.image} alt={`${photo.site}の${photo.work}`}/><div><b>{photo.site}</b><span>{photo.work}</span><small>{photo.member}</small><footer><time>{photo.time}</time>{photo.comments > 0 && <em>♡ {photo.comments}</em>}</footer></div></button>;
}

function MobilePhotos({ photos: photoItems, onSelect }: { photos:(typeof photos)[number][], onSelect:(p:(typeof photos)[number])=>void }) {
  const today = formatLocalDateTime(new Date()).slice(0, 10);
  const todayPhotos = photoItems.filter(photo => photo.time.slice(0, 10) === today);
  return <section className="mobile-gallery"><div className="mobile-summary"><b>今日の写真</b><span>{todayPhotos.length}件</span></div>{todayPhotos.map(p => <PhotoCard key={p.id} photo={p} onClick={() => onSelect(p)}/>)}{todayPhotos.length === 0 && <div className="mobile-empty"><span>▧</span><b>今日の写真はまだありません</b><small>撮影して保存すると、ここに表示されます</small></div>}</section>;
}

function PhotoModal({ photo, onClose }: { photo:(typeof photos)[number], onClose:()=>void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><article className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><img src={photo.image} alt={`${photo.site}の写真`}/><div className="modal-info"><span className="status">保存済み</span><h2>{photo.site}</h2><dl><div><dt>作業項目</dt><dd>{photo.work}</dd></div><div><dt>撮影者</dt><dd>{photo.member}</dd></div><div><dt>撮影日時</dt><dd>{photo.time}</dd></div><div><dt>メモ</dt><dd>{photo.memo}</dd></div></dl><button className="download">画像をダウンロード</button></div></article></div>;
}
