import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { Star, MapPin, Plus, X, ThumbsUp, Search } from 'lucide-react';

const PLACE_TAGS = ['Wi-Fi', 'Silencioso', 'Tomadas', 'Café', 'Gratuito', 'AC', 'Aberto 24h', 'Estacionamento', 'Acessível'];

function StarRating({ value, onChange, size = 24 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ cursor: onChange ? 'pointer' : 'default', fontSize: size }}
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
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [myReview, setMyReview] = useState(null);
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewStars, setNewReviewStars] = useState(0);
  const [saving, setSaving] = useState(false);

  // New place form
  const [newPlace, setNewPlace] = useState({ name: '', address: '', city: '', tags: [] });

  useEffect(() => { loadPlaces(); }, []);

  async function loadPlaces() {
    const { data } = await supabase.from('places').select('*').order('avg_rating', { ascending: false });
    setPlaces(data || []);
    setLoading(false);
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
    // Update avg rating
    const { data: allReviews } = await supabase.from('place_reviews').select('rating').eq('place_id', selected.id);
    const avg = allReviews.reduce((a, b) => a + b.rating, 0) / allReviews.length;
    await supabase.from('places').update({ avg_rating: Math.round(avg * 10) / 10, review_count: allReviews.length }).eq('id', selected.id);
    await loadReviews(selected.id);
    await loadPlaces();
    setSaving(false);
  }

  async function addPlace() {
    if (!newPlace.name || !newPlace.city) return;
    setSaving(true);
    await supabase.from('places').insert({ ...newPlace, added_by: session.user.id, avg_rating: 0, review_count: 0, created_at: new Date().toISOString() });
    setNewPlace({ name: '', address: '', city: '', tags: [] });
    setShowAdd(false);
    await loadPlaces();
    setSaving(false);
  }

  function toggleTag(tag) {
    setNewPlace(p => ({ ...p, tags: p.tags.includes(tag) ? p.tags.filter(t => t !== tag) : [...p.tags, tag] }));
  }

  const filtered = places.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.city.toLowerCase().includes(search.toLowerCase())
  );

  // Group by city
  const byCity = filtered.reduce((acc, p) => {
    if (!acc[p.city]) acc[p.city] = [];
    acc[p.city].push(p);
    return acc;
  }, {});

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Lugares para Estudar</h2>
        <p style={styles.sub}>Ranking por cidade avaliado pela comunidade</p>
        <div style={styles.searchRow}>
          <div style={styles.searchBox}>
            <Search size={16} color="#9CA3AF" />
            <input placeholder="Buscar por nome ou cidade..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent' }} />
          </div>
          <button style={styles.addBtn} onClick={() => setShowAdd(true)}><Plus size={18} /></button>
        </div>
      </div>

      <div style={styles.list}>
        {loading && <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 40 }}>Carregando lugares...</p>}
        {!loading && filtered.length === 0 && (
          <div style={styles.empty}>
            <span style={{ fontSize: 48 }}>📍</span>
            <p>Nenhum lugar cadastrado ainda.</p>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Seja o primeiro a adicionar um lugar!</p>
          </div>
        )}

        {Object.entries(byCity).map(([city, cityPlaces]) => (
          <div key={city}>
            <div style={styles.cityHeader}>
              <MapPin size={14} color="#6C63FF" />
              <span>{city}</span>
            </div>
            {cityPlaces.map((place, i) => (
              <div key={place.id} className="card" style={styles.placeCard} onClick={() => openPlace(place)}>
                <div style={styles.rank}>#{i + 1}</div>
                <div style={styles.placeInfo}>
                  <h3 style={styles.placeName}>{place.name}</h3>
                  {place.address && <p style={styles.placeAddr}>{place.address}</p>}
                  <div style={styles.tagsRow}>
                    {(place.tags || []).map(t => <span key={t} style={styles.tag}>{t}</span>)}
                  </div>
                </div>
                <div style={styles.ratingBox}>
                  <Star size={16} fill="#FBBF24" color="#FBBF24" />
                  <span style={styles.ratingNum}>{place.avg_rating > 0 ? place.avg_rating.toFixed(1) : '—'}</span>
                  <span style={styles.reviewCount}>({place.review_count || 0})</span>
                </div>
              </div>
            ))}
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
              <input placeholder="Nome do lugar *" value={newPlace.name} onChange={e => setNewPlace(p => ({ ...p, name: e.target.value }))} />
              <input placeholder="Endereço (opcional)" value={newPlace.address} onChange={e => setNewPlace(p => ({ ...p, address: e.target.value }))} />
              <input placeholder="Cidade *" value={newPlace.city} onChange={e => setNewPlace(p => ({ ...p, city: e.target.value }))} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Características:</p>
              <div style={styles.tagsRow}>
                {PLACE_TAGS.map(t => (
                  <button key={t} onClick={() => toggleTag(t)}
                    style={{ ...styles.tag, ...(newPlace.tags.includes(t) ? { background: '#EEF0FF', color: '#6C63FF', borderColor: '#6C63FF' } : { background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB' }), cursor: 'pointer' }}>
                    {t}
                  </button>
                ))}
              </div>
              <button className="btn-primary" onClick={addPlace} disabled={saving}>
                {saving ? 'Salvando...' : 'Adicionar lugar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Place Detail Modal */}
      {selected && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{selected.name}</h3>
              <button style={styles.closeBtn} onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              {selected.address && <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 8 }}>📍 {selected.address}, {selected.city}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <StarRating value={selected.avg_rating} size={20} />
                <span style={{ fontWeight: 700, fontSize: 18 }}>{selected.avg_rating > 0 ? selected.avg_rating.toFixed(1) : '—'}</span>
                <span style={{ color: '#9CA3AF', fontSize: 13 }}>({selected.review_count} avaliações)</span>
              </div>
              <div style={{ ...styles.tagsRow, marginBottom: 20 }}>
                {(selected.tags || []).map(t => <span key={t} style={styles.tag}>{t}</span>)}
              </div>

              <div style={{ background: '#F7F8FF', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{myReview ? 'Sua avaliação' : 'Avaliar este lugar'}</p>
                <StarRating value={newReviewStars} onChange={setNewReviewStars} size={28} />
                <textarea placeholder="Deixe um comentário (opcional)" value={newReviewText} onChange={e => setNewReviewText(e.target.value)}
                  rows={2} style={{ marginTop: 12, resize: 'none' }} />
                <button className="btn-primary" style={{ marginTop: 8 }} onClick={submitReview} disabled={!newReviewStars || saving}>
                  {saving ? 'Salvando...' : myReview ? 'Atualizar avaliação' : 'Enviar avaliação'}
                </button>
              </div>

              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Avaliações da comunidade</p>
              {reviews.length === 0 && <p style={{ color: '#9CA3AF', fontSize: 14 }}>Nenhuma avaliação ainda. Seja o primeiro!</p>}
              {reviews.map(r => (
                <div key={r.id} style={styles.reviewCard}>
                  <div style={styles.reviewHeader}>
                    <img src={r.profiles?.avatar_url} alt="" style={styles.reviewAvatar} />
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{r.profiles?.name}</p>
                      <StarRating value={r.rating} size={14} />
                    </div>
                  </div>
                  {r.comment && <p style={{ fontSize: 13, color: '#374151', marginTop: 8, lineHeight: 1.5 }}>{r.comment}</p>}
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
  header: { padding: '24px 16px 12px', background: 'white', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  title: { fontFamily: 'Sora, sans-serif', fontSize: 22, color: '#1A1A2E' },
  sub: { color: '#6B7280', fontSize: 13, margin: '4px 0 12px' },
  searchRow: { display: 'flex', gap: 10 },
  searchBox: { flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#F3F4F6', borderRadius: 12, padding: '10px 14px' },
  addBtn: { background: '#6C63FF', color: 'white', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  list: { padding: '16px' },
  empty: { textAlign: 'center', padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#6B7280' },
  cityHeader: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#6C63FF', textTransform: 'uppercase', letterSpacing: 0.5, margin: '20px 0 10px' },
  placeCard: { display: 'flex', alignItems: 'center', gap: 12, padding: 16, marginBottom: 10, cursor: 'pointer', transition: 'transform 0.15s' },
  rank: { width: 28, height: 28, borderRadius: '50%', background: '#EEF0FF', color: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  placeInfo: { flex: 1 },
  placeName: { fontFamily: 'Sora, sans-serif', fontSize: 15, color: '#1A1A2E' },
  placeAddr: { color: '#9CA3AF', fontSize: 12, margin: '2px 0 6px' },
  tagsRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tag: { background: '#F3F4F6', color: '#6B7280', padding: '3px 10px', borderRadius: 20, fontSize: 12 },
  ratingBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 },
  ratingNum: { fontWeight: 700, fontSize: 16, color: '#1A1A2E' },
  reviewCount: { fontSize: 11, color: '#9CA3AF' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200, padding: '0' },
  modal: { background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 12px' },
  modalTitle: { fontFamily: 'Sora, sans-serif', fontSize: 18, color: '#1A1A2E' },
  closeBtn: { background: '#F3F4F6', color: '#374151', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 24px' },
  reviewCard: { background: '#F7F8FF', borderRadius: 12, padding: 14, marginBottom: 10 },
  reviewHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: '50%' },
};
