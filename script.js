// ---------------- CAMPUS DATA ----------------
const CENTER = [80.2658, 26.4983]; // lng, lat — verified CSJMU coordinate

const PLACES = [
  { id:'gate',    name:'Main Gate',                 cat:'Access',   color:'#e8912d', lng:80.2648, lat:26.4979,
    desc:'Primary vehicle entrance off the Kalyanpur road.' },
  { id:'admin',   name:'Administrative Block',       cat:'Admin',    color:'#2b3a67', lng:80.2658, lat:26.4983,
    desc:'Registrar, admissions, and examination offices.' },
  { id:'library', name:'Central Library',            cat:'Academic', color:'#3e7c59', lng:80.2657, lat:26.4988,
    desc:'Main university library and reading halls.' },
  { id:'uiet',    name:'UIET (Engg. & Tech.)',       cat:'Academic', color:'#3e7c59', lng:80.2665, lat:26.4993,
    desc:'University Institute of Engineering and Technology.' },
  { id:'health',  name:'School of Health Sciences',  cat:'Academic', color:'#3e7c59', lng:80.2640, lat:26.4990,
    desc:'Health sciences teaching and research block.' },
  { id:'audi',    name:'Auditorium',                 cat:'Campus Life', color:'#a855c9', lng:80.2652, lat:26.4985,
    desc:'Main hall for events, seminars, and convocations.' },
  { id:'sports',  name:'Sports Complex',              cat:'Campus Life', color:'#a855c9', lng:80.2648, lat:26.4998,
    desc:'Grounds, courts, and indoor sports facilities.' },
  { id:'boys',    name:'Swarn Jayanti Boys Hostel',   cat:'Hostel',   color:'#c96f16', lng:80.2670, lat:26.4972,
    desc:'Residential block for male students.' },
  { id:'girls',   name:'Girls Hostel',                cat:'Hostel',   color:'#c96f16', lng:80.2645, lat:26.4975,
    desc:'Residential block for female students.' },
  { id:'canteen', name:'Canteen & Food Court',        cat:'Campus Life', color:'#a855c9', lng:80.2660, lat:26.4980,
    desc:'Everyday meals, snacks, and chai breaks.' },
];

const CATEGORY_META = {
  'Academic':    { color:'#3e7c59', blurb:'Blocks, labs & the library' },
  'Hostel':      { color:'#c96f16', blurb:'Where everyone actually lives' },
  'Campus Life': { color:'#a855c9', blurb:'Sports, food & events' },
  'Admin':       { color:'#2b3a67', blurb:'Registrar & official offices' },
  'Access':      { color:'#e8912d', blurb:'Gates & entry points' },
};

const CATEGORIES = ['All', ...new Set(PLACES.map(p=>p.cat))];

const RASTER_STYLE = {
    version: 8,
    sources: {
        osm: {
            type: "raster",
            tiles: [
                "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors"
        }
    },
    layers: [
        {
            id: "osm",
            type: "raster",
            source: "osm"
        }
    ]
};

function markerEl(color){
  const el = document.createElement('div');
  el.style.width='16px'; el.style.height='16px'; el.style.borderRadius='50%';
  el.style.background = color; el.style.border='2px solid #faf8f2';
  el.style.boxShadow='0 2px 6px rgba(0,0,0,.4)'; el.style.cursor='pointer';
  return el;
}

// ---------------- HERO MAP (view only) ----------------
const heroMap = new maplibregl.Map({
    container: "hero-map",

    style: "https://tiles.openfreemap.org/styles/liberty",

    center: [80.2674919, 26.5030206],

    zoom: 17,

    pitch: 45,

    bearing: -20
});

heroMap.addControl(new maplibregl.NavigationControl());

new maplibregl.Marker({
    color: "#E74C3C"
})
.setLngLat([80.2674919, 26.5030206])
.setPopup(
    new maplibregl.Popup().setHTML(`
        <h3>CSJM University</h3>
        <p>Kanpur, Uttar Pradesh</p>
    `)
)
.addTo(heroMap);

// ---------------- FINDER MAP (interactive) ----------------
const finderMap = new maplibregl.Map({
  container: 'finder-map',
  style: RASTER_STYLE,
  center: CENTER,
  zoom: 15.7,
  attributionControl: false
});
finderMap.addControl(new maplibregl.NavigationControl({showCompass:false}), 'top-right');
finderMap.addControl(new maplibregl.AttributionControl({compact:true}), 'bottom-right');

let finderMarkers = {};
let activeCategory = 'All';

finderMap.on('load', () => {
  PLACES.forEach(p => {
    const el = markerEl(p.color);
    el.dataset.id = p.id;
    const marker = new maplibregl.Marker({element: el})
      .setLngLat([p.lng, p.lat])
      .setPopup(new maplibregl.Popup({offset:14}).setHTML(
        `<div class="popup-title">${p.name}</div><div class="popup-cat">${p.cat}</div>`
      ))
      .addTo(finderMap);
    finderMarkers[p.id] = marker;
  });

  finderMap.addSource('route', { type:'geojson', data:{type:'Feature', geometry:{type:'LineString', coordinates:[]}} });
  finderMap.addLayer({
    id:'route-line', type:'line', source:'route',
    layout:{ 'line-cap':'round' },
    paint:{ 'line-color':'#e8912d', 'line-width':3, 'line-dasharray':[0.4, 1.6] }
  });

  plotRoute();
});

// ---------------- CONTROLS: selects, chips, directory ----------------
const fromSelect = document.getElementById('from-select');
const toSelect = document.getElementById('to-select');
PLACES.forEach(p => {
  fromSelect.add(new Option(p.name, p.id));
  toSelect.add(new Option(p.name, p.id));
});
fromSelect.value = 'gate';
toSelect.value = 'library';

function haversine(a, b){
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function plotRoute(){
  const from = PLACES.find(p => p.id === fromSelect.value);
  const to = PLACES.find(p => p.id === toSelect.value);
  if(!from || !to || !finderMap.getSource('route')) return;

  const distM = haversine(from, to);
  const distDisplay = distM > 950 ? (distM/1000).toFixed(2) + ' km' : Math.round(distM) + ' m';
  const walkMin = Math.max(1, Math.round((distM / 80))); // ~4.8km/h walking pace

  document.getElementById('rr-dist').textContent = distDisplay;
  document.getElementById('rr-meta').textContent =
    from.id === to.id ? "That's the same spot — pick a destination" : `≈ ${walkMin} min walk · ${from.name} → ${to.name}`;

  finderMap.getSource('route').setData({
    type:'Feature',
    geometry:{ type:'LineString', coordinates: [[from.lng, from.lat],[to.lng, to.lat]] }
  });

  const bounds = new maplibregl.LngLatBounds([from.lng, from.lat], [from.lng, from.lat]);
  bounds.extend([to.lng, to.lat]);
  finderMap.fitBounds(bounds, { padding: 70, maxZoom: 16.5, duration: 600 });
}

fromSelect.addEventListener('change', plotRoute);
toSelect.addEventListener('change', plotRoute);
document.getElementById('swap-btn').addEventListener('click', () => {
  const a = fromSelect.value; fromSelect.value = toSelect.value; toSelect.value = a; plotRoute();
});

// category chips
const chipWrap = document.getElementById('category-filters');
CATEGORIES.forEach(cat => {
  const btn = document.createElement('button');
  btn.className = 'chip' + (cat==='All' ? ' active' : '');
  btn.textContent = cat;
  btn.addEventListener('click', () => {
    activeCategory = cat;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    Object.entries(finderMarkers).forEach(([id, marker]) => {
      const place = PLACES.find(p => p.id === id);
      const show = cat === 'All' || place.cat === cat;
      marker.getElement().style.display = show ? 'block' : 'none';
    });
  });
  chipWrap.appendChild(btn);
});

// directory list
const dirWrap = document.getElementById('directory');
PLACES.forEach(p => {
  const item = document.createElement('div');
  item.className = 'dir-item';
  item.innerHTML = `<span class="dot" style="background:${p.color}"></span> ${p.name}`;
  item.addEventListener('click', () => {
    toSelect.value = p.id;
    plotRoute();
    finderMap.flyTo({ center:[p.lng, p.lat], zoom:17, duration:700 });
    finderMarkers[p.id].togglePopup();
  });
  dirWrap.appendChild(item);
});

// ---------------- EXPLORE BY CATEGORY ----------------
const exploreGrid = document.getElementById('explore-grid');
Object.entries(CATEGORY_META).forEach(([cat, meta]) => {
  const count = PLACES.filter(p => p.cat === cat).length;
  const card = document.createElement('button');
  card.className = 'cat-card';
  card.innerHTML = `
    <div class="cat-swatch" style="background:${meta.color}22; color:${meta.color};">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>
    </div>
    <h4>${cat}</h4>
    <p>${meta.blurb} · ${count} location${count===1?'':'s'}</p>
  `;
  card.addEventListener('click', () => {
    document.getElementById('wayfind').scrollIntoView({behavior:'smooth'});
    setTimeout(() => {
      const chip = [...document.querySelectorAll('.chip')].find(c => c.textContent === cat);
      if(chip) chip.click();
    }, 500);
  });
  exploreGrid.appendChild(card);
});

// ---------------- REVEAL ON SCROLL ----------------
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ---------------- MOBILE MENU ----------------
document.querySelector('.menu-btn').addEventListener('click', () => {
  const links = document.querySelector('.nav-links');
  const open = links.style.display === 'flex';
  links.style.display = open ? 'none' : 'flex';
  links.style.cssText += open ? '' : 'position:absolute; top:100%; left:0; right:0; flex-direction:column; background:var(--paper); padding:20px 32px; border-bottom:1px solid var(--line-light); gap:18px;';
});