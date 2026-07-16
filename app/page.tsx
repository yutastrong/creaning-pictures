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

export default function Home() {
  const [mobileTab, setMobileTab] = useState<"capture" | "photos">("capture");
  const [work, setWork] = useState("トイレ清掃");
  const [site, setSite] = useState("第二小学校");
  const [memo, setMemo] = useState("");
  const [toast, setToast] = useState("");
  const [cameraError, setCameraError] = useState(false);
  const [filters, setFilters] = useState({ work: "すべて", site: "すべて", member: "すべて" });
  const [selected, setSelected] = useState<(typeof photos)[number] | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const savedWork = localStorage.getItem("field-work");
    const savedSite = localStorage.getItem("field-site");
    if (savedWork && siteMap[savedWork]) setWork(savedWork);
    if (savedSite) setSite(savedSite);
    startCamera();
    return () => { const stream = videoRef.current?.srcObject as MediaStream | null; stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError(true); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraError(false);
    } catch { setCameraError(true); }
  }

  function changeWork(value: string) {
    setWork(value); localStorage.setItem("field-work", value);
    const nextSite = siteMap[value][0]; setSite(nextSite); localStorage.setItem("field-site", nextSite);
  }

  function changeSite(value: string) { setSite(value); localStorage.setItem("field-site", value); }

  function capture() {
    setToast("保存中…");
    setTimeout(() => { setToast("✓ 保存しました"); setMemo(""); setTimeout(() => setToast(""), 2400); }, 700);
  }

  const filtered = useMemo(() => photos.filter(p =>
    (filters.work === "すべて" || p.work === filters.work) &&
    (filters.site === "すべて" || p.site === filters.site) &&
    (filters.member === "すべて" || p.member === filters.member)
  ), [filters]);

  return <>
    <div className="mobile-app">
      <main className="mobile-main">
        <header className="mobile-header"><span className="eyebrow">FIELD NOTE</span><h1>{mobileTab === "capture" ? "撮影" : "写真一覧"}</h1><button className="avatar" aria-label="プロフィール">山</button></header>
        {mobileTab === "capture" ? <>
          <div className="preview">
            <video ref={videoRef} autoPlay playsInline muted />
            {cameraError && <div className="camera-fallback"><img src={photos[0].image} alt="現場のプレビュー"/><div className="camera-message"><span>カメラを利用できません</span><button onClick={startCamera}>もう一度試す</button></div></div>}
            <span className="live-pill">● LIVE</span>
          </div>
          <section className="capture-fields">
            <label className="field-card"><span>作業項目</span><select value={work} onChange={e => changeWork(e.target.value)}>{Object.keys(siteMap).map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="field-card site-field"><span>現場選択</span><select value={site} onChange={e => changeSite(e.target.value)}>{siteMap[work].map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="memo-card"><span>メモ <small>任意</small></span><textarea maxLength={200} value={memo} onChange={e => setMemo(e.target.value)} placeholder="作業内容や気になる点を入力"/><b>{memo.length}/200</b></label>
          </section>
          <button className="capture-button" onClick={capture} disabled={!work || !site} aria-label="写真を撮影"><span>▣</span></button>
          {toast && <div className="toast" role="status">{toast}</div>}
        </> : <MobilePhotos onSelect={setSelected}/>} 
      </main>
      <nav className="bottom-nav" aria-label="メインナビゲーション">
        <button className={mobileTab === "capture" ? "active" : ""} onClick={() => setMobileTab("capture")}><Icon>●</Icon>撮影</button>
        <button className={mobileTab === "photos" ? "active" : ""} onClick={() => setMobileTab("photos")}><Icon>▧</Icon>写真一覧</button>
      </nav>
    </div>

    <div className="desktop-app">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">▣</div><span>現場写真共有</span></div>
        <nav><button className="active"><Icon>▧</Icon>写真一覧</button><button><Icon>☷</Icon>撮影項目</button><button><Icon>♙</Icon>メンバー</button></nav>
        <div className="profile"><div className="profile-avatar">山</div><div><b>山田 太郎</b><small>事務所スタッフ</small></div><span>⌄</span></div>
      </aside>
      <main className="desktop-main">
        <header className="page-head"><div><span className="eyebrow">PHOTO LIBRARY</span><h1>写真一覧</h1></div><button className="refresh" onClick={() => location.reload()}>↻ <span>更新</span></button></header>
        <section className="workspace">
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
        </section>
      </main>
    </div>
    {selected && <PhotoModal photo={selected} onClose={() => setSelected(null)}/>} 
  </>;
}

function PhotoCard({ photo, onClick }: { photo:(typeof photos)[number], onClick:()=>void }) {
  return <button className="photo-card" onClick={onClick}><img src={photo.image} alt={`${photo.site}の${photo.work}`}/><div><b>{photo.site}</b><span>{photo.work}</span><small>{photo.member}</small><footer><time>{photo.time}</time>{photo.comments > 0 && <em>♡ {photo.comments}</em>}</footer></div></button>;
}

function MobilePhotos({ onSelect }: { onSelect:(p:(typeof photos)[number])=>void }) {
  return <section className="mobile-gallery"><div className="mobile-summary"><b>自分の写真</b><span>{photos.slice(0,5).length}件</span></div>{photos.slice(0,5).map(p => <PhotoCard key={p.id} photo={p} onClick={() => onSelect(p)}/>)}</section>;
}

function PhotoModal({ photo, onClose }: { photo:(typeof photos)[number], onClose:()=>void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><article className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><img src={photo.image} alt={`${photo.site}の写真`}/><div className="modal-info"><span className="status">保存済み</span><h2>{photo.site}</h2><dl><div><dt>作業項目</dt><dd>{photo.work}</dd></div><div><dt>撮影者</dt><dd>{photo.member}</dd></div><div><dt>撮影日時</dt><dd>{photo.time}</dd></div><div><dt>メモ</dt><dd>{photo.memo}</dd></div></dl><button className="download">画像をダウンロード</button></div></article></div>;
}
