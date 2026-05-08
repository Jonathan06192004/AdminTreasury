const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const isSuperAdmin = user.role === 'superadmin';
  const currentYear = new Date().getFullYear();

  // Get accessible mission IDs
  let missionQuery = dbData.from('missions').select('id, code');
  if (!isSuperAdmin) missionQuery = missionQuery.eq('code', user.mission_code);
  const { data: missions } = await missionQuery;
  if (!missions || missions.length === 0) return;

  const missionIds = missions.map(m => m.id);

  // Get all church IDs under those missions
  const { data: churchData } = await dbData
    .from('churches')
    .select('id, name, districts!inner(mission_id)')
    .in('districts.mission_id', missionIds);

  const churches = churchData || [];
  const churchIds = churches.map(c => c.id);

  if (churchIds.length === 0) {
    setStats(0, 0, 0, 0);
    renderRecent([]);
    return;
  }

  // Fetch stats in parallel
  const [tithesRes, offeringsRes, districtsRes] = await Promise.all([
    dbData.from('tithes').select('amount').in('church_id', churchIds).eq('year', currentYear),
    dbData.from('offerings').select('amount').in('church_id', churchIds).eq('year', currentYear),
    dbData.from('districts').select('id').in('mission_id', missionIds)
  ]);

  const totalTithes   = (tithesRes.data || []).reduce((s, r) => s + (r.amount || 0), 0);
  const totalOfferings = (offeringsRes.data || []).reduce((s, r) => s + (r.amount || 0), 0);

  setStats(totalTithes, totalOfferings, churches.length, (districtsRes.data || []).length);

  // Fetch recent entries (last 5 tithes + last 5 offerings)
  const [recentTithes, recentOfferings] = await Promise.all([
    dbData.from('tithes').select('*, churches(name)').in('church_id', churchIds)
      .order('year', { ascending: false }).order('month', { ascending: false }).limit(5),
    dbData.from('offerings').select('*, churches(name)').in('church_id', churchIds)
      .order('year', { ascending: false }).order('month', { ascending: false }).limit(5)
  ]);

  const combined = [
    ...(recentTithes.data || []).map(r => ({ ...r, type: 'Tithe' })),
    ...(recentOfferings.data || []).map(r => ({ ...r, type: 'Offering' }))
  ].sort((a, b) => b.year - a.year || b.month - a.month).slice(0, 10);

  renderRecent(combined);
});

function setStats(tithes, offerings, churchCount, districtCount) {
  document.getElementById('stat-tithes').textContent    = fmt(tithes);
  document.getElementById('stat-offerings').textContent = fmt(offerings);
  document.getElementById('stat-churches').textContent  = churchCount;
  document.getElementById('stat-districts').textContent = districtCount;
}

function fmt(val) {
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderRecent(rows) {
  const tbody = document.getElementById('recent-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#64748b;">No entries found.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.churches?.name || '—'}</td>
      <td><span class="badge ${r.type === 'Tithe' ? 'tithe' : 'offering'}">${r.type}</span></td>
      <td>${MONTHS[r.month]}</td>
      <td>${r.year}</td>
      <td class="amt-pos">${fmt(r.amount)}</td>
    </tr>
  `).join('');
}
