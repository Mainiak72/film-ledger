let movies = JSON.parse(localStorage.getItem('movies') || '[]');
let currentMode = 'movie'; // 'movie' or 'tv'

function save() {
  localStorage.setItem('movies', JSON.stringify(movies));
}

function setMode(mode) {
  currentMode = mode;
  document.getElementById('btnMovies').classList.toggle('active', mode === 'movie');
  document.getElementById('btnTV').classList.toggle('active', mode === 'tv');
  render();
}

function filtered() {
  return movies.filter(m => (m.mediaType || 'movie') === currentMode);
}

function getViewMode(tabId) {
  const views = JSON.parse(localStorage.getItem('viewModes') || '{}');
  return views[tabId] || 'medium';
}

function setViewMode(tabId, mode) {
  const views = JSON.parse(localStorage.getItem('viewModes') || '{}');
  views[tabId] = mode;
  localStorage.setItem('viewModes', JSON.stringify(views));
  if (tabId === 'alltime') renderAllTime();
  else if (tabId === 'top10') renderTop10();
  else if (tabId === 'decades') renderDecades();
  else if (tabId === 'seasonal') renderSeasonal(seasonalPage);
  else if (tabId === 'recs') renderRecommendations(recsPage);
  else if (tabId === 'free') renderFree(freePage);
  else if (tabId === 'watchlist') renderList('watchlist', m => m.status === 'watchlist');
  else if (tabId === 'watching') renderList('watching', m => m.status === 'watching');
  else if (tabId === 'least') renderLeastFavorite();
  else render();
}

function tabHead(titleHtml, tabId, refreshKind) {
  const refresh = refreshKind === 'seasonal'
    ? `<button type="button" class="refresh-btn" onclick="renderSeasonal(seasonalPage + 1)">Refresh</button>`
    : refreshKind === 'recs'
    ? `<button type="button" class="refresh-btn" onclick="renderRecommendations(recsPage + 1)">Refresh</button>`
    : refreshKind === 'free'
    ? `<button type="button" class="refresh-btn" onclick="renderFree(freePage)">Refresh</button>`
    : '';
  return `<div class="tab-head"><div class="tab-title">${titleHtml}</div><div class="tab-tools">${viewToggle(tabId)}${refresh}</div></div>`;
}

function libraryButtons(m, rank) {
  const del = rank ? '' : `<button onclick="deleteMovie('${m.id}')" class="del">Del</button>`;
  const rate = rank ? '' : `<button onclick="editRating('${m.id}')">${m.rating != null ? 'Re-rate' : 'Rate'}</button>`;
  if (m.status === 'watched') {
    const fav = `<button onclick="toggleFavorite('${m.id}')">${m.favorite ? 'Unfav' : 'Fav'}</button>`;
    return `<button onclick="showDetails('${m.id}')">Details</button>${rate}${fav}${del}`;
  }
  return `<button onclick="showDetails('${m.id}')">Details</button>`
    + (m.status !== 'watchlist' ? `<button onclick="setStatus('${m.id}', 'watchlist')">Watchlist</button>` : '')
    + (m.status !== 'watching' ? `<button onclick="setStatus('${m.id}', 'watching')">Watching</button>` : '')
    + rate + del;
}
function viewToggle(tabId) {
  const mode = getViewMode(tabId);
  return `<div class="view-toggle">
    <button class="${mode==='bullet'?'active':''}" onclick="setViewMode('${tabId}','bullet')" title="Bullet">•</button>
    <button class="${mode==='medium'?'active':''}" onclick="setViewMode('${tabId}','medium')" title="List">☰</button>
    <button class="${mode==='large'?'active':''}" onclick="setViewMode('${tabId}','large')" title="Posters">▣</button>
  </div>`;
}

function rankedWatched(list) {
  return [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (a.order || 0) - (b.order || 0) || (a.title || '').localeCompare(b.title || ''));
}

function buildTop(candidates, pinKey) {
  const sorted = rankedWatched(candidates.filter(m => m.rating != null && m.status === 'watched'));
  const forced = sorted.filter(m => m[pinKey] && sorted.indexOf(m) >= 10).slice(0, 10);
  const room = 10 - forced.length;
  const head = sorted.filter(m => !forced.some(f => f.id === m.id)).slice(0, room);
  return rankedWatched([...head, ...forced]);
}

function refreshTopSets() {
  const all = buildTop(filtered(), 'pinAllTime');
  window._allTimeIds = new Set(all.map(m => m.id));
  const decades = {};
  filtered().forEach(m => {
    if (!m.year || m.rating == null || m.status !== 'watched') return;
    const d = Math.floor(m.year / 10) * 10;
    (decades[d] = decades[d] || []).push(m);
  });
  const decadeIds = new Set();
  Object.values(decades).forEach(group => {
    buildTop(group, 'pinDecade').forEach(m => decadeIds.add(m.id));
  });
  window._decadeIds = decadeIds;
}

function topActions(m) {
  if (m.status !== 'watched' || m.rating == null) return '';
  const inAll = window._allTimeIds && window._allTimeIds.has(m.id);
  const dec = m.year ? Math.floor(m.year / 10) * 10 : null;
  const inDec = dec && window._decadeIds && window._decadeIds.has(m.id);
  return `<button class="top-add${inAll ? ' on' : ''}" onclick="addToTop('${m.id}','alltime')">${inAll ? 'In All Time' : 'All Time'}</button>`
    + (dec ? `<button class="top-add${inDec ? ' on' : ''}" onclick="addToTop('${m.id}','decade')">${inDec ? 'In ' + dec + 's' : dec + 's'}</button>` : '');
}

function addToTop(id, which) {
  const m = movies.find(x => x.id === id);
  if (!m) return;
  if (m.status !== 'watched' || m.rating == null) {
    alert('Rate it first.');
    return;
  }
  if (which === 'decade' && !m.year) {
    alert('No year on this one, so it can’t go on a decade list.');
    return;
  }
  const key = which === 'decade' ? 'pinDecade' : 'pinAllTime';
  const label = which === 'decade' ? (Math.floor(m.year / 10) * 10 + 's') : 'All Time';
  refreshTopSets();
  const already = which === 'decade' ? window._decadeIds.has(m.id) : window._allTimeIds.has(m.id);
  if (m[key] || already) {
    if (!m[key] && already) {
      alert(`"${m.title}" is already in your ${label} Top 10 because of its score.`);
      return;
    }
    askConfirm(`Remove "${m.title}" from your ${label} Top 10?`, () => {
      m[key] = false;
      save();
      render();
    });
    return;
  }
  const pool = which === 'decade'
    ? filtered().filter(x => x.year && Math.floor(x.year / 10) * 10 === Math.floor(m.year / 10) * 10)
    : filtered();
  const sorted = rankedWatched(pool.filter(x => x.rating != null && x.status === 'watched'));
  const natural = new Set(sorted.slice(0, 10).map(x => x.id));
  const extra = sorted.filter(x => x[key] && !natural.has(x.id));
  if (!natural.has(m.id) && extra.length >= 10) {
    alert(`Your ${label} Top 10 is full of ones you added. Take one off first.`);
    return;
  }
  m[key] = true;
  save();
  render();
}

function renderItem(m, view, rank) {
  const title = escapeHtml(m.title || '');
  const gold = (m.freeLinks && m.freeLinks.some(s => s[0] === 'Internet Archive')) ? 'color:#d4af37; font-weight:600;' : '';
  const titleHtml = `<span style="${gold}">${rank ? rank + '. ' : ''}${title}</span>`;
  const year = m.year || '';
  const rating = m.rating != null ? `<span class="rating">${m.rating}%</span>` : '';
  const origin = m.origin
    ? (m.origin === 'theatrical'
        ? '<span class="origin-badge theatrical">Theatrical</span>'
        : '<span class="origin-badge streaming">Streaming</span>')
    : '';
  const posterUrl = m.poster ? `https://image.tmdb.org/t/p/w342${m.poster}` : '';
  const posterImg = posterUrl
    ? `<img src="${posterUrl}" alt="" class="poster">`
    : '<div class="poster poster-placeholder"></div>';

  if (view === 'bullet') {
    return `<div class="bullet-item" onclick="showDetails('${m.id}')">
      <span class="bullet-title">${titleHtml}</span>
      <span class="bullet-actions" onclick="event.stopPropagation()">${rating}${libraryButtons(m, rank)}</span>
    </div>`;
  }

  if (view === 'large') {
    const shortDesc = (m.overview || m.notes || '').slice(0, 80);
    const isFirst = rank === 1;
    return `<div class="poster-card ${isFirst ? 'first-place' : ''}">
      ${isFirst ? '<div class="laurel"></div>' : ''}
      <div onclick="showDetails('${m.id}')" style="cursor:pointer; position:relative;">
        ${rank ? `<div class="poster-rank ${isFirst ? 'gold' : ''}">${rank}</div>` : ''}
        ${posterImg}
        <div class="poster-title">${titleHtml}</div>
        <div class="poster-meta">${year} ${rating}</div>
        ${shortDesc ? `<div class="poster-desc">${escapeHtml(shortDesc)}${shortDesc.length >= 80 ? '…' : ''}</div>` : ''}
      </div>
      <div class="poster-actions" onclick="event.stopPropagation()">${libraryButtons(m, rank)}</div>
    </div>`;
  }

  // medium
  const smallPoster = m.poster
    ? `<img src="https://image.tmdb.org/t/p/w92${m.poster}" style="width:42px; height:63px; border-radius:4px; object-fit:cover; margin-right:10px; flex-shrink:0;">`
    : '<div style="width:42px; height:63px; background:#222; border-radius:4px; margin-right:10px; flex-shrink:0;"></div>';
  return `
    <div class="card" style="cursor:pointer;" onclick="showDetails('${m.id}')">
      <div class="movie-item">
        ${smallPoster}
        <div class="movie-info">
          <div class="title">${titleHtml}${origin}</div>
          <div class="meta">${year} ${m.genre ? '· ' + m.genre : ''}</div>
        </div>
        ${rating}
      </div>
      <div class="item-actions" onclick="event.stopPropagation()">${libraryButtons(m, rank)}</div>
    </div>
  `;
}

function render() {
  refreshTopSets();
  renderList('watchlist', m => m.status === 'watchlist');
  renderList('watching', m => m.status === 'watching');
  renderAllTime();
  renderTop10();
  renderDecades();
  renderLeastFavorite();
  renderSeasonal(seasonalPage);
  renderFree(freePage);
  renderRecommendations(recsPage);
  renderStats();
  renderSettings();
}

function renderList(tabId, filter) {
  const el = document.getElementById(tabId);
  const list = filtered().filter(filter).sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const view = getViewMode(tabId);
  
  const searchable = ['watchlist', 'watching', 'alltime'].includes(tabId);
  const genres = [...new Set(filtered().map(m => m.genre).filter(Boolean))].sort();
  let html = tabHead(`<span class="tab-count">${list.length} total</span>`, tabId);
  if (searchable) {
    html += `<div style="margin-bottom:12px; display:flex; gap:6px;">
      <input id="${tabId}Search" placeholder="Search..." oninput="filterTab('${tabId}')" style="flex:1; background:#141210; color:#f5f0e6; border:1px solid #2e2820; padding:10px; border-radius:8px;">
      ${tabId === 'watchlist' ? watchlistFilterBar() : ''}
    </div><div id="${tabId}List" class="list-container ${view}">`;
  } else {
    html += `<div class="list-container ${view}">`;
  }

  if (list.length === 0) {
    html += '<div class="empty">Nothing here yet.</div>';
  } else {
    html += list.map(m => renderItem(m, view)).join('');
  }
  html += '</div>';
  el.innerHTML = html;
}

let watchlistFilters = { genres: [] };

function addWatchlistFilter(genre) {
  if (!watchlistFilters.genres.includes(genre)) watchlistFilters.genres.push(genre);
  renderList('watchlist', m => m.status === 'watchlist');
}
function removeWatchlistFilter(genre) {
  watchlistFilters.genres = watchlistFilters.genres.filter(g => g !== genre);
  renderList('watchlist', m => m.status === 'watchlist');
}
function watchlistFilterBar() {
  const allGenres = [...new Set(movies.filter(m => m.status === 'watchlist').flatMap(m => (m.genre || '').split(',').map(g => g.trim()).filter(Boolean)))].sort();
  const active = watchlistFilters.genres.map(g => `<span class="filter-chip" onclick="removeWatchlistFilter('${escapeHtml(g)}')">${escapeHtml(g)} ×</span>`).join('');
  const available = allGenres.filter(g => !watchlistFilters.genres.includes(g));
  return `<div class="free-filters">
    <button type="button" onclick="document.getElementById('watchlistAdd').classList.toggle('hide')">+ Filter</button>
    <div id="watchlistAdd" class="hide" style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
      ${available.map(g => `<button type="button" onclick="addWatchlistFilter('${escapeHtml(g)}')" style="padding:4px 10px; font-size:0.75rem; border-radius:6px; background:#141210; color:#f5f0e6; border:1px solid #2e2820;">${escapeHtml(g)}</button>`).join('')}
    </div>
    <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">${active}</div>
  </div>`;
}
function filterTab(tabId) {
  refreshTopSets();
  const query = document.getElementById(tabId + 'Search').value.toLowerCase().trim();
  const genres = tabId === 'watchlist' ? watchlistFilters.genres : [];
  const listEl = document.getElementById(tabId + 'List');
  const view = getViewMode(tabId);
  let list = filtered();
  if (tabId === 'watchlist') list = list.filter(m => m.status === 'watchlist');
  else if (tabId === 'watching') list = list.filter(m => m.status === 'watching');
  else if (tabId === 'alltime') list = list.filter(m => m.status === 'watched');
  list = list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (genres.length) list = list.filter(m => genres.some(g => (m.genre || '').split(',').map(x => x.trim()).includes(g)));

  const filteredList = query 
    ? list.filter(m => m.title.toLowerCase().includes(query) || (m.genre && m.genre.toLowerCase().includes(query)))
    : list;

  listEl.className = `list-container ${view}`;
  listEl.innerHTML = filteredList.length
    ? filteredList.map(m => renderItem(m, view)).join('')
    : '<div class="empty">No matches.</div>';
}

function movieCard(m, rank) {
  const poster = m.poster
    ? `<img src="https://image.tmdb.org/t/p/w92${m.poster}" style="width:42px; height:63px; border-radius:4px; object-fit:cover; margin-right:10px; flex-shrink:0;">`
    : '<div style="width:42px; height:63px; background:#222; border-radius:4px; margin-right:10px; flex-shrink:0;"></div>';
  const rating = m.rating != null ? `<span class="rating">${m.rating}%</span>` : '';
  const origin = m.origin 
    ? (m.origin === 'theatrical' 
        ? '<span style="background:#d4af37; color:#000; padding:1px 6px; border-radius:8px; font-size:0.65rem; margin-left:6px; font-weight:600;">Theatrical</span>'
        : '<span style="background:#4b5563; color:#fff; padding:1px 6px; border-radius:8px; font-size:0.65rem; margin-left:6px;">Streaming</span>')
    : '';
  return `
    <div class="card" style="cursor:pointer;" onclick="showDetails('${m.id}')">
      <div class="movie-item">
        ${poster}
        <div class="movie-info">
          <div class="title">${rank ? rank + '. ' : ''}${escapeHtml(m.title)}${origin}</div>
          <div class="meta">${m.year || ''} ${m.genre ? '· ' + m.genre : ''}</div>
        </div>
        ${rating}
      </div>
      <div class="item-actions" onclick="event.stopPropagation()">${libraryButtons(m, rank)}</div>
    </div>
  `;
}

function showSearchDetails(tmdbId, mediaType) {
  const apiKey = localStorage.getItem('tmdbKey');
  if (!apiKey) return alert('Add your TMDB key first.');
  const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
  Promise.all([
    fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${apiKey}&language=en-US&append_to_response=credits,release_dates,videos`).then(r => r.json()),
    fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}/watch/providers?api_key=${apiKey}`).then(r => r.json())
  ]).then(([details, providers]) => {
    if (!details || details.success === false) { alert('Could not load details.'); return; }
    const tempId = 'search-' + tmdbId;
    const existing = movies.find(x => x.tmdbId === Number(tmdbId) && (x.mediaType || 'movie') === endpoint);
    if (existing) { showDetails(existing.id); return; }
    const temp = { id: tempId, tmdbId: Number(tmdbId), mediaType: endpoint, title: details.title || details.name, poster: details.poster_path, status: 'search' };
    movies.push(temp);
    showDetails(tempId);
    setTimeout(() => { movies = movies.filter(x => x.id !== tempId); }, 0);
  }).catch(() => alert('Could not load details.'));
}

function showDetails(id) {
  const m = movies.find(x => x.id === id);
  if (!m || !m.tmdbId) {
    alert('No details available for this entry.');
    return;
  }
  const apiKey = localStorage.getItem('tmdbKey');
  if (!apiKey) {
    alert('Add your TMDB API key first.');
    return;
  }
  refreshTopSets();
  const endpoint = m.mediaType === 'tv' ? 'tv' : 'movie';
  
  Promise.all([
    fetch(`https://api.themoviedb.org/3/${endpoint}/${m.tmdbId}?api_key=${apiKey}&language=en-US&append_to_response=credits,release_dates,videos`).then(r => r.json()),
    fetch(`https://api.themoviedb.org/3/${endpoint}/${m.tmdbId}/watch/providers?api_key=${apiKey}`).then(r => r.json())
  ]).then(([details, providers]) => {
    const overview = details.overview || 'No description available.';
    const releaseDate = details.release_date || details.first_air_date || '—';
    const usProviders = providers.results?.US || {};
    const flatrate = usProviders.flatrate || [];
    const free = [...(usProviders.free || []), ...(usProviders.ads || [])];
    const rent = usProviders.rent || [];
    const buy = usProviders.buy || [];

    // Credits
    const cast = (details.credits?.cast || []).slice(0, 8).map(c => c.name).join(', ') || '—';
    const directors = (details.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name).join(', ') || '—';
    const writers = (details.credits?.crew || []).filter(c => ['Writer', 'Screenplay', 'Story'].includes(c.job)).map(c => c.name).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5).join(', ') || '—';
    const producers = (details.credits?.crew || []).filter(c => c.job === 'Producer').slice(0, 5).map(c => c.name).join(', ') || '—';

    const videos = (details.videos?.results || []).filter(v => v.site === 'YouTube');
    const trailer = videos.find(v => v.type === 'Trailer' && v.official) || videos.find(v => v.type === 'Trailer') || videos.find(v => v.type === 'Teaser') || videos[0];
    const trailerLink = trailer ? `<a class="trailer-link" href="https://www.youtube.com/watch?v=${trailer.key}" target="_blank" rel="noopener">▶ ${escapeHtml(trailer.name || 'Trailer')}</a>` : '';

    let originBadge = '';
    if (endpoint === 'movie' && details.release_dates?.results) {
      const us = details.release_dates.results.find(r => r.iso_3166_1 === 'US');
      if (us && us.release_dates.some(d => d.type === 3)) originBadge = '<span style="background:#d4af37; color:#000; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600; margin-right:6px;">Theatrical</span>';
    }
    if (!originBadge) originBadge = '<span style="background:#4b5563; color:#fff; padding:3px 8px; border-radius:12px; font-size:0.75rem; margin-right:6px;">Streaming</span>';

    // Included services as colored bubbles
    const colorMap = {
      'netflix': '#E50914',
      'prime video': '#00A8E1',
      'amazon': '#00A8E1',
      'disney': '#113CCF',
      'max': '#6B2C91',
      'hbo': '#6B2C91',
      'hulu': '#1CE783',
      'apple': '#000000',
      'paramount': '#0064FF',
      'peacock': '#7B2D8E',
      'roku': '#B565D8',
      'youtube': '#FF0000',
      'tubi': '#FA382F',
      'pluto': '#333333',
      'freevee': '#232F3E',
      'crunchyroll': '#F47521',
      'starz': '#0033A0',
      'showtime': '#B22222',
      'amc': '#8B0000',
      'fubo': '#FF6B00',
      'philo': '#00C853'
    };
    const textColorMap = { 'hulu': '#000', 'apple': '#fff' };
    // Deduplicate and prefer base plans
    const seen = new Set();
    const uniqueProviders = [];
    [...free, ...flatrate].forEach(p => {
      let name = p.provider_name;
      // Normalize to base plan
      if (name.toLowerCase().includes('paramount')) name = 'Paramount+';
      else if (name.toLowerCase().includes('peacock')) name = 'Peacock';
      else if (name.toLowerCase().includes('roku')) name = 'Roku';
      else if (name.toLowerCase().includes('max') || name.toLowerCase().includes('hbo')) name = 'Max';
      else if (name.toLowerCase().includes('prime')) name = 'Prime Video';
      else if (name.toLowerCase().includes('disney')) name = 'Disney+';
      else if (name.toLowerCase().includes('hulu')) name = 'Hulu';
      else if (name.toLowerCase().includes('netflix')) name = 'Netflix';
      else if (name.toLowerCase().includes('apple')) name = 'Apple TV+';
      
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueProviders.push({ ...p, provider_name: name });
      }
    });

    const serviceLinks = {
      'prime video': ['Included with an Amazon Prime or Prime Video subscription.', 'https://www.primevideo.com'],
      'max': ['Included with a Max subscription.', 'https://www.max.com'],
      'netflix': ['Included with a Netflix subscription.', 'https://www.netflix.com'],
      'disney+': ['Included with a Disney+ subscription.', 'https://www.disneyplus.com'],
      'hulu': ['Included with a Hulu subscription.', 'https://www.hulu.com'],
      'peacock': ['Included with a Peacock subscription.', 'https://www.peacocktv.com'],
      'paramount+': ['Included with a Paramount+ subscription.', 'https://www.paramountplus.com'],
      'apple tv+': ['Included with an Apple TV+ subscription.', 'https://tv.apple.com'],
      'roku': ['Available on Roku Channel.', 'https://therokuchannel.roku.com']
    };
    let includedBubbles = '';
    uniqueProviders.forEach(p => {
      const name = p.provider_name.toLowerCase();
      let color = '#16a34a';
      let textColor = '#fff';
      for (const key in colorMap) {
        if (name.includes(key)) { color = colorMap[key]; textColor = textColorMap[key] || '#fff'; break; }
      }
      const info = serviceLinks[name] || [`Included with a ${p.provider_name} subscription.`, ''];
      includedBubbles += `<button type="button" class="svc-bubble" style="background:${color}; color:${textColor};" onclick="showServiceInfo(this, '${escapeHtml(info[0]).replace(/'/g, "\\'")}', '${info[1]}')">${escapeHtml(p.provider_name)}</button>`;
    });
    const includedSection = includedBubbles ? `<div style="margin-bottom:10px; display:flex; flex-wrap:wrap; align-items:center; gap:4px;"><span style="color:#aaa; font-size:0.75rem; margin-right:4px;">With subscription:</span>${includedBubbles}</div><div id="svcInfo" class="svc-info" hidden></div>` : '';

    const makeList = (arr) => arr.length ? arr.map(p => `<div style="font-size:0.8rem; margin:2px 0;">${escapeHtml(p.provider_name)}</div>`).join('') : '<div style="color:#666; font-size:0.75rem;">—</div>';

    const modal = document.createElement('div');
    modal.className = 'sheet';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:999; display:flex; align-items:center; justify-content:center; padding:20px;';
    const posterBlock = m.poster
      ? `<img src="https://image.tmdb.org/t/p/w342${m.poster}" alt="" style="width:92px; height:138px; object-fit:cover; border-radius:6px; flex-shrink:0;">`
      : '<div style="width:92px; height:138px; background:#222; border-radius:6px; flex-shrink:0;"></div>';

    const links = m.freeLinks || [];
    const bestFree = links[0];
    const otherFree = links.slice(1);
    const isFree = m.freeLinks && m.freeLinks.some(s => s[0] === 'Internet Archive');
    const titleStyle = isFree ? 'color:#d4af37;' : '';

    modal.innerHTML = `
      <div style="background:#1a1714; border:1px solid #2e2820; border-radius:12px; max-width:380px; width:100%; padding:14px; max-height:85vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h3 style="font-size:1rem; ${titleStyle}">${escapeHtml(m.title)}</h3>
          <button type="button" onclick="this.closest('.sheet').remove()" style="background:none; border:none; color:#aaa; font-size:1.4rem; cursor:pointer;">×</button>
        </div>
        <div style="display:flex; gap:10px; margin-bottom:10px;">
          ${posterBlock}
          <div style="flex:1;">
            <div style="margin-bottom:6px;">${originBadge}${trailerLink}</div>
            <a href="${bestFree ? bestFree[1] : '#'}" target="_blank" rel="noopener" style="display:block; background:#d4af37; color:#1a1408; text-align:center; padding:8px; border-radius:8px; font-weight:700; text-decoration:none; font-size:0.85rem;">${bestFree ? 'Watch Free' : 'No free link'}</a>
          </div>
        </div>
        <p style="color:#ddd; font-size:0.85rem; line-height:1.4; margin-bottom:10px;">${escapeHtml(overview)}</p>
        <div style="font-size:0.75rem; color:#aaa; margin-bottom:10px;">
          <div>${releaseDate} · ${escapeHtml(directors)}</div>
          <div>${escapeHtml(cast)}</div>
        </div>
        <div style="font-size:0.7rem; color:#888; margin-bottom:10px;">
          Also free: ${otherFree.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener" style="color:#d4af37; margin-right:8px;">${n}</a>`).join('')}
        </div>
        <div style="border-top:1px solid #2e2820; padding-top:10px;">
          <div class="item-actions" style="margin-bottom:8px;">
            <button onclick="editRating('${m.id}')">${m.rating != null ? 'Re-rate' : 'Rate'}</button>
            <button onclick="toggleFavorite('${m.id}')">${m.favorite ? 'Unfav' : 'Fav'}</button>
            ${m.status === 'watched' && m.rating != null ? topActions(m) : ''}
            <button onclick="deleteMovie('${m.id}')" class="del">Delete</button>
          </div>
          <textarea id="commentInput" placeholder="Note..." style="width:100%; min-height:40px; background:#141210; color:#f5f0e6; border:1px solid #2e2820; border-radius:6px; padding:6px; font-size:0.8rem;">${escapeHtml(m.notes || '')}</textarea>
          <button onclick="saveComment('${m.id}')" style="margin-top:4px; font-size:0.75rem;">Save</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }).catch(() => alert('Could not load details.'));
}

function showServiceInfo(btn, text, url) {
  const box = btn.closest('.sheet')?.querySelector('#svcInfo');
  if (!box) return;
  box.hidden = false;
  box.innerHTML = url
    ? `${escapeHtml(text)} <a href="${url}" target="_blank" rel="noopener">Open ${escapeHtml(btn.textContent)}</a>`
    : escapeHtml(text);
}

function saveComment(id) {
  const m = movies.find(x => x.id === id);
  if (!m) return;
  const input = document.getElementById('commentInput');
  if (input) m.notes = input.value.trim();
  save();
  alert('Comment saved.');
  document.querySelector('div[style*="position:fixed"]')?.remove();
  render();
}

function renderAllTime() {
  refreshTopSets();
  const el = document.getElementById('alltime');
  let list = filtered().filter(m => m.status === 'watched');
  const rated = list.filter(m => m.rating != null);
  const avg = rated.length ? Math.round(rated.reduce((s, m) => s + m.rating, 0) / rated.length) : null;
  const favs = list.filter(m => m.favorite).length;
  const view = getViewMode('alltime');

  const sortBy = document.getElementById('alltimeSort')?.value || 'rating';
  if (sortBy === 'title') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (sortBy === 'year') list.sort((a, b) => (b.year || 0) - (a.year || 0));
  else if (sortBy === 'worst') list.sort((a, b) => (a.rating || 0) - (b.rating || 0));
  else list.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  let html = tabHead(`<span class="tab-count">${list.length} watched${avg != null ? ' · avg ' + avg + '%' : ''}${favs ? ' · ' + favs + ' favorites' : ''}</span>`, 'alltime');
  html += `<div style="margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
    <input id="alltimeSearch" placeholder="Search..." oninput="filterTab('alltime')" style="flex:1; min-width:120px; background:#222; color:white; border:1px solid #2a2a2a; padding:10px; border-radius:8px;">
    <select id="alltimeSort" onchange="renderAllTime()" style="background:#222; color:white; border:1px solid #2a2a2a; padding:10px; border-radius:8px;">
      <option value="rating" ${sortBy==='rating'?'selected':''}>Best Rated</option>
      <option value="worst" ${sortBy==='worst'?'selected':''}>Worst Rated</option>
      <option value="title" ${sortBy==='title'?'selected':''}>Title</option>
      <option value="year" ${sortBy==='year'?'selected':''}>Year</option>
    </select>
    <button onclick="toggleFavoriteFilter()" style="font-size:0.75rem; padding:8px 12px;">${window.showFavoritesOnly ? 'Show All' : 'Favorites Only'}</button>
  </div><div id="alltimeList" class="list-container ${view}">`;

  const displayList = window.showFavoritesOnly ? list.filter(m => m.favorite) : list;
  if (displayList.length === 0) {
    html += '<div class="empty">' + (window.showFavoritesOnly ? 'No favorites yet.' : 'Nothing here yet.') + '</div>';
  } else {
    html += displayList.map(m => renderItem(m, view)).join('');
  }
  html += '</div>';
  el.innerHTML = html;
}

function toggleFavorite(id) {
  const m = movies.find(x => x.id === id);
  if (!m) return;
  m.favorite = !m.favorite;
  save();
  document.querySelectorAll('.sheet').forEach(el => el.remove());
  render();
}

function toggleFavoriteFilter() {
  window.showFavoritesOnly = !window.showFavoritesOnly;
  renderAllTime();
}

function renderTop10() {
  const el = document.getElementById('top10');
  const allTime = buildTop(filtered(), 'pinAllTime');
  const view = getViewMode('top10');
  
  let html = tabHead('<h3>Top 10</h3>', 'top10');
  if (allTime.length === 0) {
    html += '<div class="empty">Rate some first.</div>';
  } else if (view === 'large') {
    const first = allTime[0];
    const rest = allTime.slice(1);
    html += `<div class="top10-pedestal">${renderItem(first, 'large', 1)}</div>`;
    if (rest.length) {
      html += `<div class="list-container large" style="margin-top:16px;">` + rest.map((m, i) => renderItem(m, 'large', i + 2)).join('') + '</div>';
    }
  } else if (view === 'bullet') {
    html += allTime.map((m, i) => renderItem(m, 'bullet', i + 1)).join('');
  } else {
    html += allTime.map((m, i) => `
      <div class="top10-row">
        <div class="rank-num">${i + 1}</div>
        <div class="move-btns">
          ${i > 0 ? `<button onclick="event.stopPropagation(); moveTop10('${m.id}', 'up')">▲</button>` : '<div style="height:22px;"></div>'}
          ${i < allTime.length - 1 ? `<button onclick="event.stopPropagation(); moveTop10('${m.id}', 'down')">▼</button>` : '<div style="height:22px;"></div>'}
        </div>
        ${m.poster ? `<img src="https://image.tmdb.org/t/p/w92${m.poster}" style="width:36px; height:54px; border-radius:4px; object-fit:cover;">` : '<div style="width:36px; height:54px; background:#222; border-radius:4px;"></div>'}
        <div style="flex:1; cursor:pointer;" onclick="showDetails('${m.id}')">
          <div class="title">${escapeHtml(m.title)}</div>
          <div class="meta">${m.year || ''} ${m.genre ? '· ' + m.genre : ''}</div>
        </div>
        <span class="rating">${m.rating}%</span>
        <div class="item-actions" onclick="event.stopPropagation()" style="margin:0;">${libraryButtons(m, i + 1)}</div>
      </div>
    `).join('');
  }
  el.innerHTML = html;
}

function moveTop10(id, direction) {
  const top10 = buildTop(filtered(), 'pinAllTime');
  const idx = top10.findIndex(m => m.id === id);
  if (idx === -1) return;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= top10.length) return;

  const moved = top10[idx];
  const target = top10[targetIdx];

  if (moved.rating === target.rating) {
    // Equal scores: just swap their order position, leave the score alone
    const tempOrder = moved.order || idx;
    moved.order = target.order || targetIdx;
    target.order = tempOrder;
  } else {
    // Different scores: swap them
    const temp = moved.rating;
    moved.rating = target.rating;
    target.rating = temp;
  }
  save();
  render();
}

function renderLeastFavorite() {
  const el = document.getElementById('least');
  const rated = filtered().filter(m => m.rating != null && m.status === 'watched' && m.rating <= 50);
  const sorted = [...rated].sort((a, b) => a.rating - b.rating || (a.title || '').localeCompare(b.title || '')).slice(0, 10);
  const view = getViewMode('least');

  let html = tabHead('<h3>Least Favorite</h3>', 'least');
  if (sorted.length === 0) {
    html += '<div class="empty">No low-rated movies yet.</div>';
  } else if (view === 'large') {
    html += `<div class="list-container large">` + sorted.map((m, i) => renderItem(m, 'large', i + 1)).join('') + '</div>';
  } else if (view === 'bullet') {
    html += sorted.map((m, i) => renderItem(m, 'bullet', i + 1)).join('');
  } else {
    html += sorted.map((m, i) => renderItem(m, 'medium', i + 1)).join('');
  }
  el.innerHTML = html;
}

function renderDecades() {
  const el = document.getElementById('decades');
  const rated = filtered().filter(m => m.rating != null && m.status === 'watched' && m.year);
  const view = getViewMode('decades');
  if (rated.length === 0) {
    el.innerHTML = tabHead('<h3>Top by Decade</h3>', 'decades') + '<div class="empty">No rated items with years.</div>';
    return;
  }
  const decades = {};
  rated.forEach(m => {
    const decade = Math.floor(m.year / 10) * 10;
    if (!decades[decade]) decades[decade] = [];
    decades[decade].push(m);
  });
  let html = tabHead('<h3>Top by Decade</h3>', 'decades');
  Object.keys(decades).sort((a, b) => b - a).forEach(dec => {
    const top = buildTop(decades[dec], 'pinDecade');
    html += `<div class="decade-header">${dec}s</div>`;
    if (view === 'large') {
      html += `<div class="list-container large">` + top.map((m, i) => renderItem(m, 'large', i + 1)).join('') + '</div>';
    } else if (view === 'bullet') {
      html += top.map((m, i) => renderItem(m, 'bullet', i + 1)).join('');
    } else {
      html += top.map((m, i) => `
        <div class="top10-row">
          <div class="rank-num">${i + 1}</div>
          <div class="move-btns">
            ${i > 0 ? `<button onclick="event.stopPropagation(); moveDecade('${m.id}', '${dec}', 'up')">▲</button>` : '<div style="height:22px;"></div>'}
            ${i < top.length - 1 ? `<button onclick="event.stopPropagation(); moveDecade('${m.id}', '${dec}', 'down')">▼</button>` : '<div style="height:22px;"></div>'}
          </div>
          ${m.poster ? `<img src="https://image.tmdb.org/t/p/w92${m.poster}" style="width:36px; height:54px; border-radius:4px; object-fit:cover;">` : '<div style="width:36px; height:54px; background:#222; border-radius:4px;"></div>'}
          <div style="flex:1; cursor:pointer;" onclick="showDetails('${m.id}')">
            <div class="title" style="${(m.freeLinks && m.freeLinks.some(s => s[0] === 'Internet Archive')) ? 'color:#d4af37; font-weight:600;' : ''}">${escapeHtml(m.title)}</div>
            <div class="meta">${m.year || ''}</div>
          </div>
          <span class="rating">${m.rating}%</span>
          <div class="item-actions" onclick="event.stopPropagation()" style="margin:0;">${libraryButtons(m, i + 1)}</div>
        </div>
      `).join('');
    }
  });
  el.innerHTML = html;
}

function moveDecade(id, decade, direction) {
  const group = filtered().filter(m => m.rating != null && m.status === 'watched' && m.year && Math.floor(m.year / 10) * 10 === parseInt(decade));
  const rated = buildTop(group, 'pinDecade');
  const idx = rated.findIndex(m => m.id === id);
  if (idx === -1) return;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= rated.length) return;

  const moved = rated[idx];
  const target = rated[targetIdx];

  if (moved.rating === target.rating) {
    const tempOrder = moved.order || idx;
    moved.order = target.order || targetIdx;
    target.order = tempOrder;
  } else {
    const temp = moved.rating;
    moved.rating = target.rating;
    target.rating = temp;
  }
  save();
  render();
}

let seasonalPage = 1;
let recsPage = 1;
let freePage = 1;

async function findFreeSources(title, runtimeMin) {
  const sources = [];
  const q = encodeURIComponent(title);
  try {
    const r = await fetch(`https://archive.org/advancedsearch.php?q=title:"${q}"+AND+mediatype:movies+AND+-title:trailer+AND+-title:teaser+AND+-title:clip&fl=identifier,runtime,title&output=json&rows=10&sort[]=downloads+desc`);
    const data = await r.json();
    for (const doc of (data.response?.docs || [])) {
      const id = doc.identifier;
      if (!id) continue;
      const docTitle = (Array.isArray(doc.title) ? doc.title[0] : doc.title || '').toLowerCase();
      if (!docTitle.includes(title.toLowerCase().slice(0, Math.min(8, title.length)))) continue;
      if (docTitle.includes('trailer') || docTitle.includes('teaser') || docTitle.includes('clip')) continue;
      let mins = 0;
      if (doc.runtime) {
        const parts = String(doc.runtime).match(/\d+/g);
        if (parts && parts.length >= 3) mins = +parts[0] * 60 + +parts[1];
        else if (parts && parts.length === 2) mins = +parts[0];
        else if (parts) mins = +parts[0];
      }
      if (!mins) continue;
      if (runtimeMin && Math.abs(mins - runtimeMin) > 20) continue;
      sources.push(['Internet Archive', `https://archive.org/embed/${id}`]);
      break;
    }
  } catch {}
  return sources;
}

async function renderFree(page = 1) {
  freePage = page;
  const el = document.getElementById('free');
  const apiKey = localStorage.getItem('tmdbKey');
  if (!apiKey) { el.innerHTML = freeFilterBar() + '<div class="empty">Add your TMDB API key in Settings to load free titles.</div>'; return; }
  el.innerHTML = freeFilterBar() + '<div class="empty">Finding theatrical movies with free copies...</div>';
  const endpoint = currentMode === 'tv' ? 'tv' : 'movie';
  let url = `https://api.themoviedb.org/3/discover/${endpoint}?api_key=${apiKey}&language=en-US&page=${page}&sort_by=popularity.desc&include_adult=false&with_release_type=2|3`;
  if (!freeFilters.decades.length) url += '&primary_release_date.gte=1920-01-01&primary_release_date.lte=1980-12-31';
  if (freeFilters.genres.length) url += '&with_genres=' + freeFilters.genres.map(g => GENRES[g]).join('|');
  if (freeFilters.decades.length) {
    const fetches = freeFilters.decades.map(d => {
      const dateParam = `&primary_release_date.gte=${d}-01-01&primary_release_date.lte=${d+9}-12-31`;
      return fetch(url + dateParam).then(r => r.json()).then(data => data.results || []).catch(() => []);
    });
    const all = await Promise.all(fetches);
    const seen = new Set();
    const results = [];
    all.flat().forEach(m => { if (!seen.has(m.id)) { seen.add(m.id); results.push(m); } });
    await showVerifiedFree(el, results.slice(0, 20), endpoint, apiKey, page);
    return;
  }
  const data = await fetch(url).then(r => r.json()).catch(() => ({ results: [] }));
  await showVerifiedFree(el, (data.results || []).slice(0, 20), endpoint, apiKey, page);
}

async function showVerifiedFree(el, results, endpoint, apiKey, page) {
  if (!results.length) { el.innerHTML = freeFilterBar() + '<div class="empty">No theatrical movies found.</div>'; return; }
  el.innerHTML = freeFilterBar() + `<div class="empty">Checking ${results.length} titles for free copies...</div>`;
  const verified = [];
  await Promise.all(results.map(async (m) => {
    const title = endpoint === 'tv' ? m.name : m.title;
    try {
      const ia = await fetch(`https://archive.org/advancedsearch.php?q=title:"${encodeURIComponent(title)}"+AND+mediatype:movies+AND+-title:trailer+AND+-title:teaser&fl=identifier,title&output=json&rows=3`).then(r => r.json());
      const doc = (ia.response?.docs || []).find(d => {
        const dt = (Array.isArray(d.title) ? d.title[0] : d.title || '').toLowerCase();
        return dt.includes(title.toLowerCase().slice(0, Math.min(10, title.length)));
      });
      if (doc) verified.push({ m, title, iaId: doc.identifier });
    } catch {}
  }));
  if (!verified.length) {
    el.innerHTML = freeFilterBar() + `<div class="empty">No free theatrical movies on this page.</div><div class="page-bar">${page > 1 ? `<button type="button" onclick="renderFree(${page - 1})">Prev</button>` : ''}<button type="button" onclick="renderFree(${page + 1})">Next</button></div>`;
    return;
  }
  const view = getViewMode('free');
  const pager = `<div class="page-bar">${page > 1 ? `<button type="button" onclick="renderFree(${page - 1})">Prev</button>` : '<span></span>'}<button type="button" onclick="renderFree(${page + 1})">Next</button></div>`;
  el.innerHTML = freeFilterBar() + tabHead('<h3>Free to Watch</h3>', 'free', 'free') + pager + `<div class="list-container ${view}">` + verified.map(({ m, title, iaId }) => {
    const year = endpoint === 'tv' ? (m.first_air_date || '').slice(0, 4) : (m.release_date || '').slice(0, 4);
    const link = `https://archive.org/embed/${iaId}`;
    const poster = m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : `https://archive.org/services/img/${iaId}`;
    const existing = movies.find(x => x.tmdbId === m.id);
    const statusLabel = existing ? `<span style="color:#4ade80; font-size:0.7rem;"> · ${existing.status}</span>` : '';
    const addBtn = existing ? '' : `<button onclick="addFromSearch(${m.id}, '${jsArg(title)}', '${year}', '', '', '${endpoint}', '${m.poster_path || ''}', 'streaming', true)">Add</button>`;
    const watchBtn = `<a href="${link}" target="_blank" rel="noopener" class="ia-watch">Watch</a>`;
    const gold = 'color:#d4af37; font-weight:600;';
    const overview = (m.overview || '').slice(0, 140);
    const desc = overview ? `<div class="poster-desc">${escapeHtml(overview)}${overview.length >= 140 ? '…' : ''}</div>` : '';
    const posterImg = `<img src="${poster}" alt="" class="poster" onerror="this.style.display='none'">`;
    const smallPoster = `<img src="${poster}" style="width:36px; height:54px; border-radius:4px; object-fit:cover; margin-right:8px;" onerror="this.style.display='none'">`;
    if (view === 'bullet') return `<div class="bullet-item"><span class="bullet-title" style="${gold}">${escapeHtml(title)}${statusLabel}</span><span class="bullet-actions">${watchBtn}${addBtn}</span></div>`;
    if (view === 'large') return `<div class="poster-card"><div style="cursor:pointer;">${posterImg}<div class="poster-title" style="${gold}">${escapeHtml(title)}</div><div class="poster-meta">${year}</div>${desc}</div><div class="poster-actions">${watchBtn}${addBtn}</div></div>`;
    return `<div class="card" style="padding:8px;"><div style="display:flex; align-items:center;">${smallPoster}<div style="flex:1;"><div class="title" style="${gold}">${escapeHtml(title)}${statusLabel}</div><div class="meta">${year}</div>${overview ? `<div style="font-size:0.75rem; color:#aaa; margin-top:2px;">${escapeHtml(overview)}</div>` : ''}</div><div>${watchBtn}${addBtn}</div></div></div>`;
  }).join('') + '</div>' + pager;
}

function addFreeFromIA(title, year, iaId) {
  const id = 'ia-' + iaId;
  if (movies.find(m => m.id === id)) { showToast('Already in library'); return; }
  movies.push({
    id,
    title,
    year: year ? +year : null,
    status: 'watchlist',
    mediaType: 'movie',
    free: true,
    freeLinks: [['Internet Archive', `https://archive.org/embed/${iaId}`]],
    added: Date.now()
  });
  save();
  showToast('Added to watchlist');
  render();
}


function renderSeasonal(page = 1) {
  seasonalPage = page;
  const el = document.getElementById('seasonal');
  const apiKey = localStorage.getItem('tmdbKey');
  if (!apiKey) { el.innerHTML = '<div class="empty">Add your TMDB API key in Settings to load seasonal titles.</div>'; return; }
  el.innerHTML = '<div class="empty">Loading seasonal...</div>';
  const month = new Date().getMonth();
  let genreId = 27, label = 'Halloween';
  if (month === 11 || month === 0) { genreId = 10749; label = 'Christmas / Romance'; }
  else if (month >= 5 && month <= 7) { genreId = 12; label = 'Summer / Adventure'; }
  else if (month === 1) { genreId = 10749; label = "Valentine's"; }
  else if (month === 10) { genreId = 10751; label = 'Thanksgiving / Family'; }
  const endpoint = currentMode === 'tv' ? 'tv' : 'movie';
  const typeLabel = currentMode === 'tv' ? 'TV Shows' : 'Movies';
  fetch(`https://api.themoviedb.org/3/discover/${endpoint}?api_key=${apiKey}&with_genres=${genreId}&language=en-US&page=${page}&sort_by=popularity.desc&include_adult=false`)
    .then(r => r.json()).then(data => {
      const results = (data.results || []).slice(0, 10);
      if (!results.length) { el.innerHTML = `<div class="empty">No ${label} ${typeLabel.toLowerCase()} found.</div>`; return; }
      const view = getViewMode('seasonal');
      el.innerHTML = tabHead(`<h3>${label} ${typeLabel}</h3>`, 'seasonal', 'seasonal') + `<div class="list-container ${view}">` + results.map(m => {
        const title = endpoint === 'tv' ? m.name : m.title;
        const year = endpoint === 'tv' ? (m.first_air_date || '').slice(0, 4) : (m.release_date || '').slice(0, 4);
        const posterPath = m.poster_path || '';
        const existing = movies.find(x => x.tmdbId === m.id && (x.mediaType || 'movie') === endpoint);
        const statusLabel = existing ? `<span style="color:#4ade80; font-size:0.7rem;"> · ${existing.status}</span>` : '';
        const addBtn = existing ? '' : `<button onclick="addFromSearch(${m.id}, '${jsArg(title)}', '${year}', '', '', '${endpoint}', '${posterPath}', 'streaming')">Add</button>`;
        const poster = posterPath ? `<img src="https://image.tmdb.org/t/p/w342${posterPath}" class="poster">` : '<div class="poster poster-placeholder"></div>';
        const small = posterPath ? `<img src="https://image.tmdb.org/t/p/w92${posterPath}" style="width:36px; height:54px; border-radius:4px; object-fit:cover; margin-right:8px;">` : '<div style="width:36px; height:54px; background:#222; border-radius:4px; margin-right:8px;"></div>';
        if (view === 'bullet') return `<div class="bullet-item" onclick="showSearchDetails(${m.id}, '${endpoint}')"><span class="bullet-title">${escapeHtml(title)}${statusLabel}</span><span class="bullet-actions" onclick="event.stopPropagation()">${addBtn}</span></div>`;
        if (view === 'large') return `<div class="poster-card"><div onclick="showSearchDetails(${m.id}, '${endpoint}')" style="cursor:pointer;">${poster}<div class="poster-title">${escapeHtml(title)}</div><div class="poster-meta">${year}</div></div><div class="poster-actions">${addBtn}</div></div>`;
        return `<div class="card" style="padding:8px;"><div style="display:flex; align-items:center; cursor:pointer;" onclick="showSearchDetails(${m.id}, '${endpoint}')">${small}<div style="flex:1;"><div class="title">${escapeHtml(title)}${statusLabel}</div><div class="meta">${year}</div></div><div onclick="event.stopPropagation()">${addBtn}</div></div></div>`;
      }).join('') + '</div>';
    }).catch(() => el.innerHTML = '<div class="empty">Failed to load seasonal titles.</div>');
}

function renderRecommendations(page = 1) {
  recsPage = page;
  const el = document.getElementById('recs');
  const highRated = filtered().filter(m => m.rating >= 75 && m.status === 'watched' && m.tmdbId).sort((a, b) => b.rating - a.rating).slice(0, 5);
  if (!highRated.length) { el.innerHTML = '<div class="empty">Rate a few movies 75%+ to get recommendations.</div>'; return; }
  const apiKey = localStorage.getItem('tmdbKey');
  if (!apiKey) { el.innerHTML = '<div class="empty">Add your TMDB API key in Settings first.</div>'; return; }
  el.innerHTML = '<div class="empty">Loading recommendations...</div>';
  Promise.all(highRated.map(seed => {
    const endpoint = seed.mediaType === 'tv' ? 'tv' : 'movie';
    return fetch(`https://api.themoviedb.org/3/${endpoint}/${seed.tmdbId}/recommendations?api_key=${apiKey}&language=en-US&page=${page}`).then(r => r.json()).then(data => ({ results: data.results || [], endpoint })).catch(() => ({ results: [], endpoint }));
  })).then(all => {
    const seen = new Set(), combined = [];
    all.forEach(group => group.results.forEach(m => {
      const key = group.endpoint + '-' + m.id;
      if (!seen.has(key) && !movies.some(x => x.tmdbId === m.id && (x.mediaType || 'movie') === group.endpoint)) { seen.add(key); combined.push({ ...m, endpoint: group.endpoint }); }
    }));
    if (!combined.length) { el.innerHTML = '<div class="empty">No new recommendations found.</div>'; return; }
    const view = getViewMode('recs');
    el.innerHTML = tabHead('<h3>Recommended</h3>', 'recs', 'recs') + `<div class="list-container ${view}">` + combined.slice(0, 10).map(m => {
      const isTV = m.endpoint === 'tv';
      const title = isTV ? m.name : m.title;
      const year = isTV ? (m.first_air_date || '').slice(0, 4) : (m.release_date || '').slice(0, 4);
      const posterPath = m.poster_path || '';
      const poster = posterPath ? `<img src="https://image.tmdb.org/t/p/w342${posterPath}" class="poster">` : '<div class="poster poster-placeholder"></div>';
      const small = posterPath ? `<img src="https://image.tmdb.org/t/p/w92${posterPath}" style="width:36px; height:54px; border-radius:4px; object-fit:cover; margin-right:8px;">` : '<div style="width:36px; height:54px; background:#222; border-radius:4px; margin-right:8px;"></div>';
      const addBtn = `<button onclick="addFromSearch(${m.id}, '${jsArg(title)}', '${year}', '', '', '${m.endpoint}', '${posterPath}', 'streaming')">Add</button>`;
      if (view === 'bullet') return `<div class="bullet-item" onclick="showSearchDetails(${m.id}, '${m.endpoint}')"><span class="bullet-title">${escapeHtml(title)}</span><span class="bullet-actions" onclick="event.stopPropagation()">${addBtn}</span></div>`;
      if (view === 'large') return `<div class="poster-card"><div onclick="showSearchDetails(${m.id}, '${m.endpoint}')" style="cursor:pointer;">${poster}<div class="poster-title">${escapeHtml(title)}</div><div class="poster-meta">${year}</div></div><div class="poster-actions">${addBtn}</div></div>`;
      return `<div class="card" style="display:flex; align-items:center; padding:8px;"><div style="display:flex; align-items:center; cursor:pointer; flex:1;" onclick="showSearchDetails(${m.id}, '${m.endpoint}')">${small}<div style="flex:1;"><div class="title">${escapeHtml(title)}</div><div class="meta">${year}</div></div></div><div onclick="event.stopPropagation()">${addBtn}</div></div>`;
    }).join('') + '</div>';
  });
}

let freeFilters = { decades: [], genres: [] };
const GENRES = { action: 28, adventure: 12, animation: 16, comedy: 35, crime: 80, documentary: 99, drama: 18, family: 10751, fantasy: 14, horror: 27, mystery: 9648, romance: 10749, 'sci-fi': 878, thriller: 53, war: 10752, western: 37 };
const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940];

function addFreeFilter(type, value) {
  if (!freeFilters[type].includes(value)) freeFilters[type].push(value);
  renderFree(1);
}
function removeFreeFilter(type, value) {
  freeFilters[type] = freeFilters[type].filter(v => v !== value);
  renderFree(1);
}
function freeFilterBar() {
  const active = [...freeFilters.decades.map(d => `<span class="filter-chip" onclick="removeFreeFilter('decades', ${d})">${d}s ×</span>`),
    ...freeFilters.genres.map(g => `<span class="filter-chip" onclick="removeFreeFilter('genres', '${g}')">${g} ×</span>`)].join('');
  return `<div class="free-filters">
    <button type="button" onclick="document.getElementById('freeAdd').classList.toggle('hide')">+ Filter</button>
    <div id="freeAdd" class="hide" style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
      <select onchange="if(this.value){addFreeFilter('decades', +this.value); this.value='';}" style="background:#141210; color:#f5f0e6; border:1px solid #2e2820; padding:4px; border-radius:6px;">
        <option value="">Decade</option>${DECADES.map(d => `<option value="${d}">${d}s</option>`).join('')}
      </select>
      <select onchange="if(this.value){addFreeFilter('genres', this.value); this.value='';}" style="background:#141210; color:#f5f0e6; border:1px solid #2e2820; padding:4px; border-radius:6px;">
        <option value="">Genre</option>${Object.keys(GENRES).map(g => `<option value="${g}">${g}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">${active}</div>
  </div>`;
}

let suggestTimer = null;

function onSearchInput() {
  clearTimeout(suggestTimer);
  const q = document.getElementById('searchQuery').value.trim();
  if (q.length < 2) {
    document.getElementById('suggestions').innerHTML = '';
    return;
  }
  suggestTimer = setTimeout(() => fetchSuggestions(q), 220);
}

function fetchSuggestions(q) {
  const apiKey = localStorage.getItem('tmdbKey') || '';
  const box = document.getElementById('suggestions');
  if (!apiKey) { box.innerHTML = '<div class="empty">Add your TMDB API key in Settings to search.</div>'; return; }
  const variants = [q, ...titleVariants(q)];
  const fetches = variants.slice(0, 3).flatMap(v => [
    fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(v)}&language=en-US&page=1`).then(r => r.json()).catch(() => ({ results: [] })),
    fetch(`https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(v)}&language=en-US&page=1`).then(r => r.json()).catch(() => ({ results: [] }))
  ]);
  Promise.all(fetches).then(results => {
    if (document.getElementById('searchQuery').value.trim() !== q) return;
    const titles = [];
    const persons = [];
    results.forEach((data, i) => {
      if (i % 2 === 0) titles.push(...(data.results || []).filter(m => m.media_type === 'movie' || m.media_type === 'tv'));
      else persons.push(...(data.results || []));
    });
    const ranked = rankSuggestions(q, uniqueById(titles), uniquePersons(persons));
    if (!ranked.length) { box.innerHTML = ''; return; }
    window._suggestions = ranked;
    box.innerHTML = ranked.map((item, i) => {
      if (item.kind === 'person') {
        const p = item.data;
        const img = p.profile_path
          ? `<img src="https://image.tmdb.org/t/p/w92${p.profile_path}" alt="">`
          : '<div class="suggest-ph"></div>';
        return `<div class="suggest-item" onclick="pickSuggestion(${i})">${img}<div><div class="title">${escapeHtml(p.name)}</div><div class="suggest-kind">${escapeHtml(p.known_for_department || 'Person')}</div></div></div>`;
      }
      const m = item.data;
      const isTV = m.media_type === 'tv';
      const title = isTV ? m.name : m.title;
      const year = (isTV ? m.first_air_date : m.release_date || '').slice(0, 4);
      const img = m.poster_path
        ? `<img src="https://image.tmdb.org/t/p/w92${m.poster_path}" alt="">`
        : '<div class="suggest-ph"></div>';
      return `<div class="suggest-item" onclick="pickSuggestion(${i})">${img}<div><div class="title">${escapeHtml(title)}</div><div class="suggest-kind">${year}${isTV ? ' · TV' : ''}</div></div></div>`;
    }).join('');
  }).catch(() => { box.innerHTML = ''; });
}

function uniquePersons(list) {
  const seen = new Set();
  return list.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
}

function rankSuggestions(query, titles, persons) {
  const q = query.toLowerCase().trim();
  const person = bestPersonMatch(persons, q);
  const exactTitle = titles.find(m => (m.title || m.name || '').toLowerCase() === q);
  const singleWord = q.split(/\s+/).length === 1;
  const items = [];
  if (person && (!exactTitle || singleWord)) items.push({ kind: 'person', data: person });
  titles
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 6)
    .forEach(m => items.push({ kind: 'title', data: m }));
  if (!person || exactTitle) {
    persons
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 2)
      .forEach(p => { if (!items.some(i => i.kind === 'person' && i.data.id === p.id)) items.push({ kind: 'person', data: p }); });
  }
  return items.slice(0, 8);
}

function pickSuggestion(i) {
  const item = (window._suggestions || [])[i];
  if (!item) return;
  document.getElementById('suggestions').innerHTML = '';
  const apiKey = localStorage.getItem('tmdbKey') || '';
  const resultsEl = document.getElementById('searchResults');
  if (item.kind === 'person') {
    document.getElementById('searchQuery').value = item.data.name;
    showPersonCredits(item.data, apiKey, resultsEl, item.data.name);
    return;
  }
  const m = item.data;
  const isTV = m.media_type === 'tv';
  document.getElementById('searchQuery').value = isTV ? m.name : m.title;
  searchMovies();
}

function searchMovies(page = 1) {
  clearTimeout(suggestTimer);
  document.getElementById('suggestions').innerHTML = '';
  const query = document.getElementById('searchQuery').value.trim();
  const apiKey = localStorage.getItem('tmdbKey') || '';
  if (!query) {
    showRecentSearches();
    return;
  }
  if (!apiKey) {
    alert('Please paste a free TMDB API key first.\nGet one at: https://www.themoviedb.org/settings/api');
    return;
  }
  localStorage.setItem('tmdbKey', apiKey);

  if (page === 1) {
    let recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    recent = recent.filter(r => r !== query);
    recent.unshift(query);
    if (recent.length > 8) recent = recent.slice(0, 8);
    localStorage.setItem('recentSearches', JSON.stringify(recent));
  }

  const resultsEl = document.getElementById('searchResults');
  resultsEl.innerHTML = '<div class="empty">Searching...</div>';
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const yearMatch = query.match(/^(19|20)\d{2}$/);
  const genreMap = {
    action: 28, adventure: 12, animation: 16, comedy: 35, crime: 80,
    documentary: 99, drama: 18, family: 10751, fantasy: 14, history: 36,
    horror: 27, music: 10402, mystery: 9648, romance: 10749, 'sci-fi': 878,
    science: 878, thriller: 53, war: 10752, western: 37
  };
  const genreKey = Object.keys(genreMap).find(g => query.toLowerCase().includes(g));

  // Year-only search
  if (yearMatch && query.length === 4) {
    const year = query;
    const endpoint = currentMode === 'tv' ? 'tv' : 'movie';
    const yearParam = endpoint === 'tv' ? `first_air_date_year=${year}` : `primary_release_year=${year}`;
    fetch(`https://api.themoviedb.org/3/discover/${endpoint}?api_key=${apiKey}&${yearParam}&language=en-US&sort_by=popularity.desc&page=${page}`)
      .then(r => r.json())
      .then(data => renderDiscoverResults(data, resultsEl, page, endpoint, apiKey))
      .catch(() => resultsEl.innerHTML = '<div class="empty">Search failed.</div>');
    return;
  }

  // Genre search
  if (genreKey && query.toLowerCase().split(/\s+/).length <= 3) {
    const genreId = genreMap[genreKey];
    const endpoint = currentMode === 'tv' ? 'tv' : 'movie';
    fetch(`https://api.themoviedb.org/3/discover/${endpoint}?api_key=${apiKey}&with_genres=${genreId}&language=en-US&sort_by=popularity.desc&page=${page}`)
      .then(r => r.json())
      .then(data => renderDiscoverResults(data, resultsEl, page, endpoint, apiKey))
      .catch(() => resultsEl.innerHTML = '<div class="empty">Search failed.</div>');
    return;
  }

  // Prefer titles. If the query is a clear person name, show their work instead.
  doTitleSearch(query, page, apiKey, resultsEl);
}

function titleMatches(m, query) {
  const title = (m.title || m.name || '').toLowerCase();
  const q = query.toLowerCase().trim();
  return title === q || title.startsWith(q + ' ') || title.includes(' ' + q);
}

function personNameMatches(person, query) {
  const q = query.toLowerCase().trim();
  const name = (person.name || '').toLowerCase();
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return false;
  if (name === q) return true;
  if (parts.some(p => p === q)) return true;
  if (q.length >= 4 && parts.some(p => p.startsWith(q))) return true;
  return false;
}

function bestPersonMatch(people, query) {
  const matches = (people || []).filter(p => personNameMatches(p, query));
  if (!matches.length) return null;
  return matches.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))[0];
}

function creditYear(m) {
  const d = m.release_date || m.first_air_date || '';
  return d ? parseInt(d.slice(0, 4), 10) || 0 : 0;
}

function byYear(a, b) {
  return creditYear(b) - creditYear(a) || (b.popularity || 0) - (a.popularity || 0);
}

function uniqueById(list) {
  const seen = new Set();
  return list.filter(m => {
    const key = m.id + ':' + (m.media_type || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function byKnown(a, b) {
  return (b.popularity || 0) - (a.popularity || 0) || creditYear(b) - creditYear(a);
}

function groupPersonCredits(person, credits) {
  const dept = person.known_for_department || '';
  const cast = credits.cast || [];
  const crew = credits.crew || [];
  const isMovie = m => m.media_type === 'movie';
  const isShow = m => m.media_type === 'tv';
  const job = (m, name) => (m.job || '') === name;
  const produced = m => /producer/i.test(m.job || '');
  const wrote = m => /writer|screenplay|story/i.test(m.job || '');

  const sections = [];
  const used = new Set();
  const add = (label, items) => {
    const list = uniqueById(items.filter(m => (isMovie(m) || isShow(m)) && !used.has(m.id + ':' + (m.media_type || '')))).sort(byKnown);
    const movies = list.filter(isMovie);
    const shows = list.filter(isShow);
    const ordered = [...movies, ...shows].slice(0, 20);
    ordered.forEach(m => used.add(m.id + ':' + (m.media_type || '')));
    if (ordered.length) sections.push({ label, items: ordered });
  };

  const isDirector = dept === 'Directing' || crew.filter(m => job(m, 'Director')).length >= 2;
  if (isDirector) {
    add('Directed', crew.filter(m => job(m, 'Director')));
    add('Produced', crew.filter(produced));
    add('Wrote', crew.filter(wrote));
    add('Other crew', crew.filter(m => !job(m, 'Director') && !produced(m) && !wrote(m)));
    add('Acted', cast);
  } else {
    const leads = cast.filter(m => (m.order == null ? 99 : m.order) <= 2);
    const other = cast.filter(m => (m.order == null ? 99 : m.order) > 2);
    add('Leading roles', leads);
    add('Other roles', other);
    add('Directed', crew.filter(m => job(m, 'Director')));
    add('Produced', crew.filter(produced));
    add('Wrote', crew.filter(wrote));
  }
  return sections;
}

function showPersonCredits(person, apiKey, resultsEl, query) {
  resultsEl.innerHTML = `<div class="page-bar"><button type="button" onclick="clearResults()">Done</button></div><div class="empty" style="margin-bottom:6px;">Showing work by <strong>${escapeHtml(person.name)}</strong> (${person.known_for_department || 'Person'})</div>`;
  fetch(`https://api.themoviedb.org/3/person/${person.id}/combined_credits?api_key=${apiKey}`)
    .then(r => r.json())
    .then(credits => {
      const sections = groupPersonCredits(person, credits);
      if (!sections.length) {
        resultsEl.innerHTML = '<div class="empty">No results.</div>';
        return;
      }
      const flat = [];
      let html = `<div class="page-bar"><button type="button" onclick="clearResults()">Done</button></div><div class="empty" style="margin-bottom:6px;">Showing work by <strong>${escapeHtml(person.name)}</strong> (${person.known_for_department || 'Person'})</div>`;
      sections.forEach(section => {
        html += `<div class="stat-label" style="margin:10px 4px 4px;">${escapeHtml(section.label)}</div>`;
        section.items.forEach(m => {
          const idx = flat.length;
          flat.push(m);
          const isTV = m.media_type === 'tv';
          const title = isTV ? m.name : m.title;
          const year = creditYear(m) || '';
          const role = m.job || m.character || '';
          const poster = m.poster_path
            ? `<img src="https://image.tmdb.org/t/p/w92${m.poster_path}" style="width:36px; height:54px; border-radius:4px; object-fit:cover; margin-right:8px;">`
            : '<div style="width:36px; height:54px; background:#222; border-radius:4px; margin-right:8px;"></div>';
          const existing = movies.find(x => x.tmdbId === m.id && (x.mediaType || 'movie') === (m.media_type || 'movie'));
          const statusLabel = existing ? `<span style="color:#4ade80; font-size:0.7rem;"> · ${existing.status === 'watched' ? 'Watched' : existing.status}</span>` : '';
          html += `
            <div class="card" style="display:flex; align-items:center; padding:6px 8px; margin-bottom:6px;${existing ? ' border-left:4px solid #4ade80; background:#1a2e1a;' : ''}">
              ${poster}
              <div style="flex:1; min-width:0;">
                <div class="title">${escapeHtml(title || '')} <span style="color:#aaa; font-size:0.7rem;">(${isTV ? 'TV' : 'Movie'})</span>${statusLabel}</div>
                <div class="meta">${year}${role ? ' · ' + escapeHtml(role) : ''}</div>
              </div>
              ${existing
                ? `<button type="button" disabled style="font-size:0.7rem; padding:4px 8px; background:#166534; border-color:#166534; color:#fff;">Added</button>`
                : `<button type="button" onclick="addFromSearchIndex(${idx})" style="font-size:0.7rem; padding:4px 8px; background:#e50914;">Add</button>`
              }
            </div>`;
        });
      });
      window.lastSearchResults = flat;
      resultsEl.innerHTML = html;
    })
    .catch(() => resultsEl.innerHTML = '<div class="empty">Search failed.</div>');
}

function doPersonSearch(query, apiKey, resultsEl) {
  fetch(`https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=1`)
    .then(r => r.json())
    .then(personData => {
      if (!personData.results || personData.results.length === 0) {
        resultsEl.innerHTML = '<div class="empty">No results.</div>';
        return;
      }
      showPersonCredits(personData.results[0], apiKey, resultsEl, query);
    })
    .catch(() => resultsEl.innerHTML = '<div class="empty">No results.</div>');
}

function doTitleSearch(query, page, apiKey, resultsEl, tried = []) {
  const personCheck = page === 1 && tried.length === 0
    ? fetch(`https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=1`).then(r => r.json()).catch(() => ({ results: [] }))
    : Promise.resolve({ results: [] });

  Promise.all([
    fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=${page}`).then(r => r.json()),
    personCheck
  ]).then(([data, people]) => {
    const person = bestPersonMatch(people.results, query);
    const hits = (data.results || []).filter(m => m.media_type === 'movie' || m.media_type === 'tv');
    const exactTitle = hits.some(m => (m.title || m.name || '').toLowerCase() === query.toLowerCase());
    const singleWord = query.trim().split(/\s+/).length === 1;
    if (person && (!exactTitle || singleWord)) {
      showPersonCredits(person, apiKey, resultsEl, query);
      return;
    }
    if (hits.length === 0 && page === 1) {
      const next = titleVariants(query).find(v => !tried.includes(v) && v !== query);
      if (next) {
        doTitleSearch(next, 1, apiKey, resultsEl, [...tried, query]);
        return;
      }
      doPersonSearch(query, apiKey, resultsEl);
      return;
    }
      const filtered = hits.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 8);
      const totalPages = data.total_pages || 1;
      const note = tried.length ? `<div class="empty" style="margin-bottom:8px;">Showing results for <strong>${escapeHtml(query)}</strong></div>` : '';
      
      const detailFetches = filtered.map(m => {
        const endpoint = m.media_type === 'tv' ? 'tv' : 'movie';
        return fetch(`https://api.themoviedb.org/3/${endpoint}/${m.id}?api_key=${apiKey}&language=en-US&append_to_response=release_dates`)
          .then(r => r.json())
          .then(details => ({ ...m, details }))
          .catch(() => ({ ...m, details: {} }));
      });

      Promise.all(detailFetches).then(withDetails => {
        window.lastSearchResults = withDetails;
        let html = withDetails.map((m, idx) => {
          const isTV = m.media_type === 'tv';
          const title = isTV ? m.name : m.title;
          const year = isTV ? (m.first_air_date || '').slice(0, 4) : (m.release_date || '').slice(0, 4);
          const poster = m.poster_path
            ? `<img src="https://image.tmdb.org/t/p/w92${m.poster_path}" style="width:42px; height:63px; border-radius:4px; object-fit:cover; margin-right:8px;">`
            : '<div style="width:42px; height:63px; background:#222; border-radius:4px; margin-right:8px;"></div>';
          const existing = movies.find(x => x.tmdbId === m.id && (x.mediaType || 'movie') === m.media_type);
          const statusLabel = existing ? `<span style="color:#4ade80; font-size:0.7rem;"> · ${existing.status === 'watched' ? 'Watched' : existing.status}</span>` : '';
          let originBadge = '';
          const usRelease = m.details.release_dates?.results?.find(r => r.iso_3166_1 === 'US');
          const hasTheatrical = !isTV && usRelease?.release_dates?.some(d => d.type === 3);
          if (hasTheatrical) originBadge = '<span style="background:#d4af37; color:#000; padding:1px 6px; border-radius:8px; font-size:0.65rem; margin-left:6px; font-weight:600;">Theatrical</span>';
          else originBadge = '<span style="background:#4b5563; color:#fff; padding:1px 6px; border-radius:8px; font-size:0.65rem; margin-left:6px;">Streaming</span>';
          return `
            <div class="card" style="display:flex; align-items:center; padding:8px;">
              ${poster}
              <div style="flex:1;">
                <div class="title">${escapeHtml(title)} <span style="color:#aaa; font-size:0.7rem;">(${isTV ? 'TV' : 'Movie'})</span>${originBadge}${statusLabel}</div>
                <div class="meta">${year}</div>
              </div>
              <div style="display:flex; gap:4px;">
                <button onclick="event.stopPropagation(); showSearchDetails(${m.id}, '${m.media_type}')" style="font-size:0.7rem; padding:4px 8px;">Details</button>
                ${existing 
                  ? `<button onclick="removeFromLibrary(${m.id}, '${m.media_type}')" style="font-size:0.7rem; padding:4px 8px; background:#5a1a1a;">Remove</button>`
                  : `<button type="button" onclick="addFromSearchIndex(${idx})" style="font-size:0.7rem; padding:4px 8px; background:#e50914;">Add</button>`
                }
              </div>
            </div>
          `;
        }).join('');
        if (totalPages > 1) {
          const bar = pageBar(page, totalPages);
          html = bar + html + bar;
        }
        const done = `<div class="page-bar"><button type="button" onclick="clearResults()">Done</button></div>`;
        resultsEl.innerHTML = done + note + html;
      });
    })
    .catch(() => resultsEl.innerHTML = '<div class="empty">Search failed.</div>');
}

function clearResults() {
  document.getElementById('searchResults').innerHTML = '';
  document.getElementById('searchQuery').value = '';
  document.getElementById('suggestions').innerHTML = '';
}

function pageBar(page, totalPages) {
  if (totalPages <= 1) return '';
  return `<div class="page-bar">
    ${page > 1 ? `<button type="button" onclick="searchMovies(${page - 1})">Prev</button>` : '<span></span>'}
    <span>Page ${page} of ${totalPages}</span>
    ${page < totalPages ? `<button type="button" onclick="searchMovies(${page + 1})">Next</button>` : '<span></span>'}
  </div>`;
}
function titleVariants(query) {
  const fixes = { resevior: 'reservoir', reservior: 'reservoir', resevoir: 'reservoir', reciev: 'receiv' };
  const words = query.toLowerCase().split(/\s+/);
  const out = new Set();
  words.forEach((w, i) => {
    if (fixes[w]) {
      const copy = words.slice();
      copy[i] = fixes[w];
      out.add(copy.join(' '));
    }
    if (w.includes('e') && w.includes('i')) {
      const swapped = w.replace('e', 'i').replace('i', 'e');
      if (swapped !== w) {
        const copy = words.slice();
        copy[i] = swapped;
        out.add(copy.join(' '));
      }
    }
  });
  return [...out];
}

function renderDiscoverResults(data, resultsEl, page, endpoint, apiKey) {
  if (!data.results || data.results.length === 0) {
    resultsEl.innerHTML = '<div class="empty">No results.</div>';
    return;
  }
  const items = data.results.slice(0, 10);
  window.lastSearchResults = items.map(m => ({ ...m, media_type: endpoint }));
  let html = items.map((m, idx) => {
    const title = endpoint === 'tv' ? m.name : m.title;
    const year = endpoint === 'tv' ? (m.first_air_date || '').slice(0, 4) : (m.release_date || '').slice(0, 4);
    const poster = m.poster_path
      ? `<img src="https://image.tmdb.org/t/p/w92${m.poster_path}" style="width:42px; height:63px; border-radius:4px; object-fit:cover; margin-right:8px;">`
      : '<div style="width:42px; height:63px; background:#222; border-radius:4px; margin-right:8px;"></div>';
    return `
      <div class="card" style="display:flex; align-items:center; padding:8px;">
        ${poster}
        <div style="flex:1;">
          <div class="title">${escapeHtml(title)} <span style="color:#aaa; font-size:0.7rem;">(${endpoint === 'tv' ? 'TV' : 'Movie'})</span></div>
          <div class="meta">${year}</div>
        </div>
        <div style="display:flex; gap:4px;">
          <button onclick="event.stopPropagation(); showSearchDetails(${m.id}, '${endpoint}')" style="font-size:0.7rem; padding:4px 8px;">Details</button>
          <button type="button" onclick="addFromSearchIndex(${idx})" style="font-size:0.7rem; padding:4px 8px; background:#e50914;">Add</button>
        </div>
      </div>
    `;
  }).join('');
  const totalPages = data.total_pages || 1;
  const bar = pageBar(page, totalPages);
  const done = `<div class="page-bar"><button type="button" onclick="clearResults()">Done</button></div>`;
  resultsEl.innerHTML = done + bar + html + bar;
}

function renderPersonResults(items, resultsEl, apiKey) {
  window.lastSearchResults = items;
  const html = items.map((m, idx) => {
    const isTV = m.media_type === 'tv';
    const title = isTV ? m.name : m.title;
    const year = isTV ? (m.first_air_date || '').slice(0, 4) : (m.release_date || '').slice(0, 4);
    const poster = m.poster_path
      ? `<img src="https://image.tmdb.org/t/p/w92${m.poster_path}" style="width:42px; height:63px; border-radius:4px; object-fit:cover; margin-right:8px;">`
      : '<div style="width:42px; height:63px; background:#222; border-radius:4px; margin-right:8px;"></div>';
    return `
      <div class="card" style="display:flex; align-items:center; padding:8px;">
        ${poster}
        <div style="flex:1;">
          <div class="title">${escapeHtml(title)} <span style="color:#aaa; font-size:0.7rem;">(${isTV ? 'TV' : 'Movie'})</span></div>
          <div class="meta">${year}</div>
        </div>
        <div style="display:flex; gap:4px;">
          <button onclick="event.stopPropagation(); showSearchDetails(${m.id}, '${m.media_type}')" style="font-size:0.7rem; padding:4px 8px;">Details</button>
          <button type="button" onclick="addFromSearchIndex(${idx})" style="font-size:0.7rem; padding:4px 8px; background:#e50914;">Add</button>
        </div>
      </div>
    `;
  }).join('');
  resultsEl.innerHTML = `<div class="page-bar"><button type="button" onclick="clearResults()">Done</button></div>` + html;
}


function showRecentSearches() {
  const resultsEl = document.getElementById('searchResults');
  const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
  if (recent.length === 0) {
    resultsEl.innerHTML = '';
    return;
  }
  resultsEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <span style="color:#aaa; font-size:0.8rem;">Recent searches</span>
      <button onclick="clearSearchHistory()" style="font-size:0.7rem; padding:3px 8px; background:#5a1a1a;">Clear</button>
    </div>
  ` + recent.map(q => `
    <div class="card" style="cursor:pointer; padding:8px;" onclick="document.getElementById('searchQuery').value='${escapeHtml(q).replace(/'/g, "\\'")}'; searchMovies();">
      ${escapeHtml(q)}
    </div>
  `).join('');
}

function exportData() {
  const data = {
    movies,
    tmdbKey: localStorage.getItem('tmdbKey') || '',
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'film-ledger-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function askConfirm(message, onYes) {
  document.querySelectorAll('.sheet').forEach(el => el.remove());
  const modal = document.createElement('div');
  modal.className = 'sheet';
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:999; display:flex; align-items:center; justify-content:center; padding:20px;';
  modal.innerHTML = `
    <div style="background:#1a1714; border:1px solid #2e2820; border-radius:12px; max-width:360px; width:100%; padding:18px;">
      <p style="margin-bottom:14px; line-height:1.4;">${escapeHtml(message)}</p>
      <div style="display:flex; gap:8px;">
        <button type="button" id="confirmYes" style="flex:1; background:#d4af37; color:#1a1408; border-color:#d4af37; font-weight:700;">Yes</button>
        <button type="button" id="confirmNo" style="flex:1;">Cancel</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  modal.querySelector('#confirmNo').onclick = () => modal.remove();
  modal.querySelector('#confirmYes').onclick = () => { modal.remove(); onYes(); };
}

function importData(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const list = Array.isArray(parsed) ? parsed : (parsed.movies || parsed.library || parsed.items);
      if (!Array.isArray(list)) throw new Error('No movie list in that file');
      askConfirm('Replace your current library with this backup? ' + list.length + ' items.', () => {
        movies = list;
        if (parsed && parsed.tmdbKey) localStorage.setItem('tmdbKey', parsed.tmdbKey);
        save();
        render();
        showToast('Imported ' + movies.length + ' items');
      });
    } catch (err) {
      alert('Could not import: ' + err.message);
    }
  };
  reader.onerror = () => alert('Could not read that file.');
  reader.readAsText(file);
}

function clearSearchHistory() {
  localStorage.removeItem('recentSearches');
  document.getElementById('searchResults').innerHTML = '';
}

// Show recent on focus
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchQuery');
  if (input) {
    input.addEventListener('focus', showRecentSearches);
  }
});

function removeFromLibrary(tmdbId, mediaType) {
  const m = movies.find(x => x.tmdbId === tmdbId && x.mediaType === mediaType);
  if (!m) return;
  askConfirm(`Remove "${m.title}" from your library?`, () => {
    movies = movies.filter(x => x.id !== m.id);
    save();
    render();
    searchMovies();
  });
}

function addFromSearchIndex(idx) {
  const m = window.lastSearchResults?.[idx];
  if (!m) return;
  const isTV = m.media_type === 'tv';
  const title = isTV ? m.name : m.title;
  const year = isTV ? (m.first_air_date || '').slice(0, 4) : (m.release_date || '').slice(0, 4);
  
  const companies = m.details?.production_companies || [];
  const networks = m.details?.networks || [];
  const allNames = [...companies, ...networks].map(c => (c.name || '').toLowerCase()).join(' ');
  // Theatrical if it has a US theatrical release (type 3)
  const usRelease = m.details?.release_dates?.results?.find(r => r.iso_3166_1 === 'US');
  const hasTheatrical = !isTV && usRelease?.release_dates?.some(d => d.type === 3);
  const origin = hasTheatrical ? 'theatrical' : 'streaming';

  addFromSearch(m.id, title, year, (m.genre_ids || []).join(','), m.overview || '', m.media_type, m.poster_path || '', origin);
}

function addFromSearch(tmdbId, title, year, genreIds, overview, mediaType, posterPath, origin, isFree) {
  if (movies.some(m => m.tmdbId === tmdbId && m.mediaType === mediaType)) {
    alert('Already in your library.');
    return;
  }
  const genreMap = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
    27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
    53: 'Thriller', 10752: 'War', 37: 'Western',
    10759: 'Action & Adventure', 10762: 'Kids', 10765: 'Sci-Fi & Fantasy'
  };
  const genres = (genreIds || '').split(',').filter(Boolean)
    .map(id => genreMap[id] || '').filter(Boolean).join(', ');

  const text = (title + ' ' + (overview || '')).toLowerCase();
  let season = '';
  if (text.includes('christmas') || text.includes('xmas') || text.includes('holiday')) season = 'Christmas';
  else if (text.includes('halloween')) season = 'Halloween';
  else if (text.includes('valentine')) season = "Valentine's";
  else if (text.includes('summer')) season = 'Summer';
  else if (text.includes('thanksgiving')) season = 'Thanksgiving';

  movies.push({
    id: Date.now().toString(),
    tmdbId,
    mediaType: mediaType || 'movie',
    title,
    year: year ? parseInt(year) : null,
    genre: genres,
    season,
    notes: '',
    overview: (overview || '').slice(0, 280),
    poster: posterPath || '',
    origin: origin || '',
    status: 'watchlist',
    free: !!isFree,
    rating: null,
    added: new Date().toISOString()
  });
  save();
  // Update library tabs only — don't re-fetch recommendations or seasonal
  renderList('watchlist', m => m.status === 'watchlist');
  renderList('watching', m => m.status === 'watching');
  renderAllTime();
  renderTop10();
  renderDecades();
  renderStats();
  renderSettings();
  // Keep search results so user can add sequels / more from the same search
  markSearchResultAdded(tmdbId, mediaType, title);
}

function markSearchResultAdded(tmdbId, mediaType, title) {
  const id = String(tmdbId);
  document.querySelectorAll('button').forEach(btn => {
    const onclick = btn.getAttribute('onclick') || '';
    let hit = false;
    const indexMatch = onclick.match(/addFromSearchIndex\((\d+)\)/);
    if (indexMatch && window.lastSearchResults) {
      const item = window.lastSearchResults[parseInt(indexMatch[1], 10)];
      hit = !!(item && String(item.id) === id);
    }
    if (!hit) {
      const direct = onclick.match(/addFromSearch\(\s*(\d+)/);
      hit = !!(direct && direct[1] === id);
    }
    if (!hit) return;

    btn.textContent = 'Added';
    btn.disabled = true;
    btn.style.background = '#166534';
    btn.style.borderColor = '#166534';
    btn.style.color = '#fff';

    const card = btn.closest('.card') || btn.closest('.poster-card');
    if (card) {
      card.style.borderLeft = '4px solid #4ade80';
      card.style.background = '#1a2e1a';
      const titleEl = card.querySelector('.title, .poster-title');
      if (titleEl && !titleEl.querySelector('.added-tag')) {
        titleEl.insertAdjacentHTML('beforeend', ' <span class="added-tag">Added</span>');
      }
    }
  });
  showToast(title ? 'Added “' + title + '”' : 'Added to your watchlist');
}

function showToast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function editRating(id) {
  const m = movies.find(x => x.id === id);
  if (!m) return;
  document.querySelectorAll('.sheet').forEach(el => el.remove());
  const modal = document.createElement('div');
  modal.className = 'sheet';
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:999; display:flex; align-items:center; justify-content:center; padding:20px;';
  modal.innerHTML = `
    <div style="background:#1a1714; border:1px solid #2e2820; border-radius:12px; max-width:360px; width:100%; padding:18px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <h3 style="font-size:1.05rem;">Rate ${escapeHtml(m.title)}</h3>
        <button type="button" onclick="this.closest('.sheet').remove()" style="background:none; border:none; color:#aaa; font-size:1.4rem; cursor:pointer;">×</button>
      </div>
      <p style="color:#a89880; font-size:0.82rem; margin-bottom:12px;">0–100. Saving marks it watched.</p>
      <input id="rateInput" type="number" min="0" max="100" inputmode="numeric" value="${m.rating != null ? m.rating : ''}" placeholder="0–100" style="width:100%; background:#141210; color:#f5f0e6; border:1px solid #2e2820; padding:12px; border-radius:10px; font-size:1.1rem; margin-bottom:12px;">
      <div style="display:flex; gap:8px;">
        <button type="button" onclick="saveRating('${m.id}')" style="flex:1; background:#d4af37; color:#1a1408; border-color:#d4af37; font-weight:700;">Save</button>
        <button type="button" onclick="this.closest('.sheet').remove()" style="flex:1;">Cancel</button>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  const input = document.getElementById('rateInput');
  if (input) {
    input.focus();
    input.select();
    input.addEventListener('keydown', e => { if (e.key === 'Enter') saveRating(id); });
  }
}

function saveRating(id) {
  const m = movies.find(x => x.id === id);
  const input = document.getElementById('rateInput');
  if (!m || !input) return;
  const num = parseInt(input.value, 10);
  if (isNaN(num) || num < 0 || num > 100) {
    alert('Enter a number between 0 and 100');
    return;
  }
  m.rating = num;
  m.status = 'watched';
  if (!m.watchedDate) m.watchedDate = new Date().toISOString().slice(0, 10);
  save();
  document.querySelectorAll('.sheet').forEach(el => el.remove());
  render();
  showToast('Rated ' + num + '% · watched');
}

function setStatus(id, status) {
  const m = movies.find(x => x.id === id);
  if (!m) return;
  askConfirm(`Move "${m.title}" to ${status}?`, () => {
    m.status = status;
    if (status === 'watched' && !m.watchedDate) m.watchedDate = new Date().toISOString().slice(0, 10);
    save();
    render();
  });
}

function deleteMovie(id) {
  const m = movies.find(x => x.id === id);
  if (!m) return;
  askConfirm(`Delete "${m.title}" permanently?`, () => {
    movies = movies.filter(x => x.id !== id);
    save();
    document.querySelectorAll('.sheet').forEach(el => el.remove());
    render();
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#39;'
  }[c]));
}

function jsArg(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ').replace(/</g, '\\u003c');
}

function renderStats() {
  const el = document.getElementById('stats');
  if (!el) return;
  const list = filtered();
  const watched = list.filter(m => m.status === 'watched');
  const rated = watched.filter(m => m.rating != null);
  const avg = rated.length ? Math.round(rated.reduce((s, m) => s + m.rating, 0) / rated.length) : null;
  const favs = watched.filter(m => m.favorite).length;
  const watchlist = list.filter(m => m.status === 'watchlist').length;
  const watching = list.filter(m => m.status === 'watching').length;
  const highest = rated.length ? rated.reduce((a, b) => (a.rating > b.rating ? a : b)) : null;
  const lowest = rated.length ? rated.reduce((a, b) => (a.rating < b.rating ? a : b)) : null;
  const theatrical = watched.filter(m => m.origin === 'theatrical').length;
  const streaming = watched.filter(m => m.origin === 'streaming').length;

  const genreCounts = {};
  watched.forEach(m => {
    (m.genre || '').split(',').forEach(g => {
      const name = g.trim();
      if (name) genreCounts[name] = (genreCounts[name] || 0) + 1;
    });
  });
  const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const decadeCounts = {};
  watched.forEach(m => {
    if (m.year) {
      const dec = Math.floor(m.year / 10) * 10;
      decadeCounts[dec] = (decadeCounts[dec] || 0) + 1;
    }
  });
  const topDecades = Object.entries(decadeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  el.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:16px;">
      <div class="stat-card"><div class="stat-num">${watched.length}</div><div class="stat-label">Watched</div></div>
      <div class="stat-card"><div class="stat-num">${avg != null ? avg + '%' : '—'}</div><div class="stat-label">Avg Rating</div></div>
      <div class="stat-card"><div class="stat-num">${favs}</div><div class="stat-label">Favorites</div></div>
      <div class="stat-card"><div class="stat-num">${watchlist}</div><div class="stat-label">Watchlist</div></div>
      <div class="stat-card"><div class="stat-num">${watching}</div><div class="stat-label">Watching</div></div>
      <div class="stat-card"><div class="stat-num">${theatrical}</div><div class="stat-label">Theatrical</div></div>
    </div>
    ${highest ? `<div style="margin-bottom:12px;"><div class="stat-label" style="margin-bottom:4px;">Highest Rated</div><div style="font-weight:600;">${escapeHtml(highest.title)} <span style="color:#d4af37;">${highest.rating}%</span></div></div>` : ''}
    ${lowest ? `<div style="margin-bottom:16px;"><div class="stat-label" style="margin-bottom:4px;">Lowest Rated</div><div style="font-weight:600;">${escapeHtml(lowest.title)} <span style="color:#d4af37;">${lowest.rating}%</span></div></div>` : ''}
    ${topGenres.length ? `<div style="margin-bottom:16px;"><div class="stat-label" style="margin-bottom:6px;">Top Genres</div>${topGenres.map(([g, n]) => `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #2a2a2a; font-size:0.9rem;"><span>${escapeHtml(g)}</span><span style="color:#d4af37;">${n}</span></div>`).join('')}</div>` : ''}
    ${topDecades.length ? `<div style="margin-bottom:18px;"><div class="stat-label" style="margin-bottom:6px;">By Decade</div>${topDecades.map(([d, n]) => `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #2a2a2a; font-size:0.9rem;"><span>${d}s</span><span style="color:#d4af37;">${n}</span></div>`).join('')}</div>` : ''}
  `;
}

const ALL_TABS = [
  ['watchlist', 'Watchlist'],
  ['watching', 'Watching'],
  ['alltime', 'Watched'],
  ['top10', 'Top 10'],
  ['decades', 'Decades'],
  ['least', 'Least'],
  ['stats', 'Stats'],
  ['recs', 'Recommended'],
  ['seasonal', 'Seasonal'],
  ['free', 'Free']
];

function visibleTabs() {
  const saved = JSON.parse(localStorage.getItem('visibleTabs') || 'null');
  return new Set(saved || ALL_TABS.map(t => t[0]));
}

function applyTabVisibility() {
  const on = visibleTabs();
  document.querySelectorAll('#subnav button').forEach(btn => {
    const tab = btn.dataset.tab;
    if (tab === 'settings') return;
    btn.classList.toggle('tab-hidden', !on.has(tab));
  });
  const active = document.querySelector('#subnav button.active');
  if (active && active.classList.contains('tab-hidden')) showTab('settings');
}

function toggleTabVisibility(tab) {
  const on = visibleTabs();
  if (on.has(tab)) on.delete(tab); else on.add(tab);
  localStorage.setItem('visibleTabs', JSON.stringify([...on]));
  applyTabVisibility();
  const btn = document.querySelector(`.tab-toggle[data-tab="${tab}"]`);
  if (btn) btn.classList.toggle('on', on.has(tab));
}

function renderSettings() {
  const el = document.getElementById('settings');
  if (!el) return;
  const key = localStorage.getItem('tmdbKey') || '';
  const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
  el.innerHTML = `
    <div class="backup-box">
      <div class="stat-label" style="margin-bottom:6px;">TMDB API Key</div>
      <p class="backup-note">Search, details, seasonal, and recommendations need a free key from <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org/settings/api</a>.</p>
      <input id="settingsKey" type="text" value="${escapeHtml(key)}" placeholder="Paste your TMDB key" autocomplete="off" style="width:100%; background:#141210; color:#f5f0e6; border:1px solid #2e2820; padding:11px; border-radius:10px; margin-bottom:10px;">
      <button type="button" onclick="saveApiKey()" style="background:#d4af37; color:#1a1408; border-color:#d4af37; font-weight:700;">Save Key</button>
    </div>
    <div class="backup-box">
      <div class="stat-label" style="margin-bottom:6px;">Library Backup</div>
      <p class="backup-note">Export saves a JSON file of your whole library — every movie and show, ratings, watched status, favorites, top 10 pins, notes, and your TMDB key. Import replaces the current library with that file.</p>
      <div class="backup-actions">
        <button type="button" onclick="exportData()">Export</button>
        <label class="import-label">Import<input type="file" accept="application/json,.json,text/json" onchange="importData(event)"></label>
      </div>
    </div>
    <div class="backup-box">
      <div class="stat-label" style="margin-bottom:6px;">Search History</div>
      <p class="backup-note">${recent.length ? recent.length + ' recent searches saved on this device.' : 'No recent searches.'}</p>
      <button type="button" onclick="clearSearchHistory(); renderSettings();">Clear History</button>
    </div>
    <div class="backup-box">
      <div class="stat-label" style="margin-bottom:6px;">Visible Tabs</div>
      <p class="backup-note">Choose which tabs show in the bar. Settings always stays.</p>
      <div class="tab-toggles">
        ${ALL_TABS.map(([id, label]) => `<button type="button" data-tab="${id}" class="tab-toggle${visibleTabs().has(id) ? ' on' : ''}" onclick="toggleTabVisibility('${id}')">${escapeHtml(label)}</button>`).join('')}
      </div>
    </div>
    <p class="backup-note" style="margin-top:14px;">Film Ledger v5.118</p>
  `;
}

function saveApiKey() {
  const input = document.getElementById('settingsKey');
  if (!input) return;
  const key = input.value.trim();
  if (!key) {
    localStorage.removeItem('tmdbKey');
    showToast('API key cleared');
  } else {
    localStorage.setItem('tmdbKey', key);
    showToast('API key saved');
  }
  renderSettings();
}

function showTab(tab) {
  document.querySelectorAll('.tabs').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#subnav button').forEach(b => b.classList.remove('active'));
  document.getElementById(tab).classList.add('active');
  document.querySelector(`#subnav button[data-tab="${tab}"]`).classList.add('active');
  if (tab === 'free') renderFree(freePage);
  else if (tab === 'recs') renderRecommendations(recsPage);
  else if (tab === 'seasonal') renderSeasonal(seasonalPage);
}

async function backfillFree() {
  const apiKey = localStorage.getItem('tmdbKey');
  if (!apiKey) return;
  const unchecked = movies.filter(m => m.tmdbId && m.free == null).slice(0, 15);
  for (const m of unchecked) {
    try {
      const endpoint = m.mediaType === 'tv' ? 'tv' : 'movie';
      const det = await fetch(`https://api.themoviedb.org/3/${endpoint}/${m.tmdbId}?api_key=${apiKey}`).then(r => r.json());
      const sources = await findFreeSources(m.title, det.runtime || 0);
      m.free = sources.length > 0 && sources.some(s => s[0] === 'Internet Archive');
      if (m.free) m.freeLinks = sources;
      else m.freeLinks = [];
    } catch { m.free = false; }
  }
  if (unchecked.length) { save(); render(); }
}

async function backfillPosters() {
  const apiKey = localStorage.getItem('tmdbKey');
  if (!apiKey) return;
  const missing = movies.filter(m => m.tmdbId && (!m.poster || !m.origin));
  if (missing.length === 0) return;

  for (const m of missing) {
    try {
      const endpoint = m.mediaType === 'tv' ? 'tv' : 'movie';
      const res = await fetch(`https://api.themoviedb.org/3/${endpoint}/${m.tmdbId}?api_key=${apiKey}&append_to_response=release_dates`);
      const data = await res.json();
      if (data.poster_path && !m.poster) m.poster = data.poster_path;
      if (!m.origin) {
        const usRelease = data.release_dates?.results?.find(r => r.iso_3166_1 === 'US');
        const hasTheatrical = endpoint === 'movie' && usRelease?.release_dates?.some(d => d.type === 3);
        m.origin = hasTheatrical ? 'theatrical' : 'streaming';
      }
    } catch (e) {}
  }
  save();
  render();
}

function sizeTop() {
  const top = document.querySelector('.sticky-top');
  if (top) document.documentElement.style.setProperty('--top-h', top.offsetHeight + 'px');
}

function startLedger() {
  sizeTop();
  window.addEventListener('resize', sizeTop);
  const input = document.getElementById("searchQuery");
  if (input && !input.dataset.bound) {
    input.dataset.bound = "1";
    input.addEventListener("focus", showRecentSearches);
  }
  if (!window.__filmLedgerTabs) {
    window.__filmLedgerTabs = true;
    document.querySelectorAll("#subnav button").forEach((btn) => {
      btn.addEventListener("click", () => showTab(btn.dataset.tab));
    });
  }
  if (!window.__filmLedgerBooted) {
    window.__filmLedgerBooted = true;
    setTimeout(backfillPosters, 500);
    setTimeout(() => renderRecommendations(1), 800);
    setTimeout(backfillFree, 1200);
  }
  render();
  applyTabVisibility();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startLedger);
} else {
  startLedger();
}

if ("serviceWorker" in navigator && document.querySelector('link[rel="manifest"][href="manifest.json"]')) {
  navigator.serviceWorker.register("service-worker.js");
}