import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { Star, MapPin, Plus, X, Search, Camera } from 'lucide-react';

const PLACE_TAGS = ['Wi-Fi', 'Silencioso', 'Tomadas', 'Café', 'Gratuito', 'AC', 'Aberto 24h', 'Estacionamento', 'Acessível', 'Biblioteca', 'Coworking'];

function StarRating({ value, onChange, size = 18 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ cursor: onChange ? 'pointer' : 'default' }}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(s)}>
          <Star size={size} fill={(hover || value) >= s ? '#FBBF24' : 'none'} color={(hover || value) >= s ? '#FBBF24' : '#D1D5DB'} />
        </span>
      ))}
    </div>
  );
}

export default function Places({ session }) {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('Todas');
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [myReview, setMyReview] = useState(null);
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewStars, setNewReviewStars] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPlace, setNewPlace] = useState({ name: '', address: '', city: '', tags: [], photo_url: '' });
  const fileRef = useRef();

  useEffect(() => { loadPlaces(); }, []);

  async function loadPlaces() {
    const { data } = await supabase.from('places').select('*').order('avg_rating', { ascending: false });
    setPlaces(data || []);
    setLoading(false);
  }

  async function uploadPhoto(file) {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `place_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('places').upload(fileName, file, { upsert: true });
    if (!error) {
      const { data: url } = supabase.storage.from('places').getPublicUrl(fileName);
      setNewPlace(p => ({ ...p, photo_url: url.publicUrl }));
    }
    setUploading(false);
  }

  async function loadReviews(placeId) {
    const { data } = await supabase.from('place_reviews')
      .select('*, profiles(name, avatar_url)')
      .eq('place_id', placeId)
      .order('created_at', { ascending: false });
    setReviews(data || []);
    const mine = (data || []).find(r => r.user_id === session.user.id);
    setMyReview(mine || null);
    if (mine) { setNewReviewStars(mine.rating); setNewReviewText(mine.comment || ''); }
    else { setNewReviewStars(0); setNewReviewText(''); }
  }

  async function openPlace(place) {
    setSelected(place);
    await loadReviews(place.id);
  }

  async function submitReview() {
    if (!newReviewStars) return;
    setSaving(true);
    if (myReview) {
      await supabase.from('place_reviews').update({ rating: newReviewStars, comment: newReviewText }).eq('id', myReview.id);
    } else {
      await supabase.from('place_reviews').insert({ place_id: selected.id, user_id: session.user.id, rating: newReviewStars, comment: newReviewText, created_at: new Date().toISOString() });
    }
    const { data: allReviews } = await supabase.from('place_reviews').select('rating').eq('place_id', selected.id);
    const avg = allReviews.reduce((a, b) => a + b.rating, 0) / allReviews.length;
    const updated = { avg_rating: Math.round(avg * 10) / 10, review_count: allReviews.length };
    await supabase.from('places').update(updated).eq('id', selected.id);
    setSelected(s => ({ ...s, ...updated }));
    await loadReviews(selected.id);
    await loadPlaces();
    setSaving(false);
  }

  async function deletePlace(placeId) {
    if (!window.confirm("Tem certeza que quer excluir este lugar?")) return;
    await supabase.from("place_reviews").delete().eq("place_id", placeId);
    await supabase.from("places").delete().eq("id", placeId);
    setSelected(null);
    await loadPlaces();
  }

  async function addPlace() {
    if (!newPlace.name || !newPlace.city) return;
    setSaving(true);
    await supabase.from('places').insert({ ...newPlace, added_by: session.user.id, avg_rating: 0, review_count: 0, created_at: new Date().toISOString() });
    setNewPlace({ name: '', address: '', city: '', tags: [], photo_url: '' });
    setShowAdd(false);
    await loadPlaces();
    setSaving(false);
  }

  function toggleTag(tag) {
    setNewPlace(p => ({ ...p, tags: p.tags.includes(tag) ? p.tags.filter(t => t !== tag) : [...p.tags, tag] }));
  }

  const cities = ['Todas', ...Array.from(new Set(places.map(p => p.city).filter(Boolean)))];
  const filtered = places.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.city.toLowerCase().includes(search.toLowerCase());
    const matchCity = cityFilter === 'Todas' || p.city === cityFilter;
    return matchSearch && matchCity;
  });

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <h2 style={styles.title}>Lugares para Estudar</h2>
            <p style={styles.sub}>Avaliados pela comunidade StudyMatch</p>
          </div>
          <button style={styles.addBtn} onClick={() => setShowAdd(true)}><Plus size={20} /></button>
        </div>
        <div style={styles.searchBox}>
          <Search size={15} color="#9CA3AF" />
          <input placeholder="Buscar lugar..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent' }} />
        </div>
        <div style={styles.cityFilters}>
          {cities.map(c => (
            <button key={c} onClick={() => setCityFilter(c)}
              style={{ ...styles.cityBtn, ...(cityFilter === c ? styles.cityBtnActive : {}) }}>{c}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={styles.list}>
        {loading && <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 40 }}>Carregando...</p>}
        {!loading && filtered.length === 0 && (
          <div style={styles.empty}>
            <span style={{ fontSize: 48 }}>📍</span>
            <p style={{ fontWeight: 600 }}>Nenhum lugar ainda</p>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Adicione o primeiro lugar da sua cidade!</p>
            <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => setShowAdd(true)}>+ Adicionar lugar</button>
          </div>
        )}
        {filtered.map((place, i) => (
          <div key={place.id} style={styles.card} onClick={() => openPlace(place)}>
            <div style={styles.cardImageWrap}>
              {place.photo_url
                ? <img src={place.photo_url} alt={place.name} style={styles.cardImage} />
                : <div style={styles.cardImagePlaceholder}><span style={{ fontSize: 40 }}>📚</span></div>
              }
              <div style={styles.rankBadge}>#{i + 1}</div>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.cardTop}>
                <h3 style={styles.placeName}>{place.name}</h3>
                <div style={styles.ratingPill}>
                  <Star size={13} fill="#FBBF24" color="#FBBF24" />
                  <span style={styles.ratingNum}>{place.avg_rating > 0 ? place.avg_rating.toFixed(1) : '—'}</span>
                </div>
              </div>
              {place.address && (
                <div style={styles.addressRow}>
                  <MapPin size={12} color="#9CA3AF" />
                  <span style={styles.address}>{place.address}, {place.city}</span>
                </div>
              )}
              <p style={styles.reviewCount}>Votos de {place.review_count || 0} usuários</p>
              <div style={styles.tagsRow}>
                {(place.tags || []).slice(0, 3).map(t => <span key={t} style={styles.tag}>{t}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Place Modal */}
      {showAdd && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Adicionar Lugar</h3>
              <button style={styles.closeBtn} onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <div style={styles.form}>
              {/* Photo upload */}
              <div style={styles.photoUpload} onClick={() => fileRef.current.click()}>
                {newPlace.photo_url
                  ? <img src={newPlace.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                  : <div style={styles.photoPlaceholder}>
                      <Camera size={28} color="#9CA3AF" />
                      <span style={{ fontSize: 13, color: '#9CA3AF', marginTop: 6 }}>{uploading ? 'Enviando...' : 'Adicionar foto'}</span>
                    </div>
                }
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => e.target.files[0] && uploadPhoto(e.target.files[0])} />
              </div>
              <input placeholder="Nome do lugar *" value={newPlace.name} onChange={e => setNewPlace(p => ({ ...p, name: e.target.value }))} />
              <input placeholder="Endereço" value={newPlace.address} onChange={e => setNewPlace(p => ({ ...p, address: e.target.value }))} />
              <input placeholder="Cidade *" value={newPlace.city} onChange={e => setNewPlace(p => ({ ...p, city: e.target.value }))} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Características:</p>
                <div style={styles.tagsRow}>
                  {PLACE_TAGS.map(t => (
                    <button key={t} onClick={() => toggleTag(t)}
                      style={{ ...styles.tag, cursor: 'pointer', ...(newPlace.tags.includes(t) ? { background: '#EEF0FF', color: '#6C63FF', border: '1px solid #6C63FF' } : { border: '1px solid #E5E7EB' }) }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn-primary" onClick={addPlace} disabled={saving || uploading || !newPlace.name || !newPlace.city}>
                {saving ? 'Salvando...' : 'Adicionar lugar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Place Detail */}
      {selected && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxHeight: '90vh', overflowY: 'auto' }}>
            {selected.photo_url
              ? <div style={{ position: 'relative' }}>
                  <img src={selected.photo_url} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: '20px 20px 0 0' }} />
                  <button style={{ ...styles.closeBtn, position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.4)', color: 'white' }} onClick={() => setSelected(null)}><X size={18} /></button>
                </div>
              : <div style={styles.modalHeader}>
                  <h3 style={styles.modalTitle}>{selected.name}</h3>
                  <button style={styles.closeBtn} onClick={() => setSelected(null)}><X size={18} /></button>
                </div>
            }
            <div style={{ padding: '16px 20px 32px' }}>
              {selected.photo_url && <h3 style={{ ...styles.modalTitle, marginBottom: 6 }}>{selected.name}</h3>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <StarRating value={selected.avg_rating} size={20} />
                <span style={{ fontWeight: 700, fontSize: 18 }}>{selected.avg_rating > 0 ? selected.avg_rating.toFixed(1) : '—'}</span>
                <span style={{ color: '#9CA3AF', fontSize: 13 }}>({selected.review_count} votos)</span>
              </div>
              {selected.address && (
                <div style={{ ...styles.addressRow, marginBottom: 12 }}>
                  <MapPin size={13} color="#6C63FF" />
                  <span style={{ fontSize: 13, color: '#6B7280' }}>{selected.address}, {selected.city}</span>
                </div>
              )}
              <div style={{ ...styles.tagsRow, marginBottom: 20 }}>
                {(selected.tags || []).map(t => <span key={t} style={styles.tag}>{t}</span>)}
              </div>

              {/* Review form */}
              <div style={{ background: '#F7F8FF', borderRadius: 14, padding: 16, marginBottom: 20 }}>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>{myReview ? 'Sua avaliação' : 'Avaliar este lugar'}</p>
                <StarRating value={newReviewStars} onChange={setNewReviewStars} size={28} />
                <textarea placeholder="Deixe um comentário (opcional)" value={newReviewText}
                  onChange={e => setNewReviewText(e.target.value)} rows={2} style={{ marginTop: 10, resize: 'none' }} />
                <button className="btn-primary" style={{ marginTop: 10 }} onClick={submitReview} disabled={!newReviewStars || saving}>
                  {saving ? 'Salvando...' : myReview ? 'Atualizar' : 'Enviar avaliação'}
                </button>
              </div>

              {selected.added_by === session.user.id && (
                <button onClick={() => deletePlace(selected.id)}
                  style={{ background: "#FEE2E2", color: "#EF4444", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", width: "100%", marginBottom: 16 }}>
                  🗑️ Excluir este lugar
                </button>
              )}
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Avaliações ({reviews.length})</p>
              {reviews.length === 0 && <p style={{ color: '#9CA3AF', fontSize: 14 }}>Nenhuma avaliação ainda!</p>}
              {reviews.map(r => (
                <div key={r.id} style={{ background: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <img src={r.profiles?.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13 }}>{r.profiles?.name}</p>
                      <StarRating value={r.rating} size={13} />
                    </div>
                  </div>
                  {r.comment && <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 480, margin: '0 auto', paddingBottom: 100 },
  header: { padding: '20px 16px 0', background: 'white', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontFamily: 'Sora, sans-serif', fontSize: 22, color: '#1A1A2E' },
  sub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  addBtn: { background: '#6C63FF', color: 'white', width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#F3F4F6', borderRadius: 12, padding: '10px 14px', marginBottom: 12 },
  cityFilters: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' },
  cityBtn: { padding: '6px 14px', borderRadius: 20, border: '1.5px solid #E5E7EB', background: 'white', color: '#6B7280', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer' },
  cityBtnActive: { background: '#6C63FF', color: 'white', borderColor: '#6C63FF' },
  list: { padding: '12px 16px' },
  empty: { textAlign: 'center', padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#6B7280' },
  card: { background: 'white', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 14, cursor: 'pointer', overflow: 'hidden' },
  cardImageWrap: { position: 'relative', height: 160 },
  cardImage: { width: '100%', height: '100%', objectFit: 'cover' },
  cardImagePlaceholder: { width: '100%', height: '100%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  rankBadge: { position: 'absolute', top: 10, left: 10, background: '#6C63FF', color: 'white', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  cardBody: { padding: '12px 14px 14px' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  placeName: { fontFamily: 'Sora, sans-serif', fontSize: 15, color: '#1A1A2E', flex: 1 },
  ratingPill: { display: 'flex', alignItems: 'center', gap: 3, background: '#FFFBEB', padding: '3px 8px', borderRadius: 20 },
  ratingNum: { fontWeight: 700, fontSize: 13, color: '#92400E' },
  addressRow: { display: 'flex', alignItems: 'center', gap: 4 },
  address: { fontSize: 12, color: '#9CA3AF' },
  reviewCount: { fontSize: 11, color: '#9CA3AF', margin: '3px 0 8px' },
  tagsRow: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  tag: { background: '#F3F4F6', color: '#6B7280', padding: '3px 10px', borderRadius: 20, fontSize: 11 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 },
  modal: { background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 12px' },
  modalTitle: { fontFamily: 'Sora, sans-serif', fontSize: 18, color: '#1A1A2E' },
  closeBtn: { background: '#F3F4F6', color: '#374151', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 24px' },
  photoUpload: { height: 140, borderRadius: 12, border: '2px dashed #E5E7EB', cursor: 'pointer', overflow: 'hidden' },
  photoPlaceholder: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' },
};
