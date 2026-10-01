// State
let allStores = [];
let map;
let markerClusterGroup;

// Brand Definitions & Normalization
const BRANDS = {
    'GS25': { id: 'gs25', color: '#007cff', match: ['지에스', 'GS'] },
    'CU': { id: 'cu', color: '#6b21a8', match: ['씨유', 'CU'] },
    '세븐일레븐': { id: 'seven', color: '#16a34a', match: ['세븐일레븐', '코리아세븐'] },
    '이마트24': { id: 'emart24', color: '#f59e0b', match: ['이마트24', '이마트위드미'] },
    '미니스톱': { id: 'ministop', color: '#0284c7', match: ['미니스톱'] },
    '기타': { id: 'other', color: '#64748b', match: [] }
};

let activeBrands = new Set(Object.keys(BRANDS));

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initBrandFilters();
    loadData();
    
    document.getElementById('region-select').addEventListener('change', updateMap);
});

function initMap() {
    // Center of Busan
    map = L.map('map', {
        zoomControl: false // Move to bottom right
    }).setView([35.1795543, 129.0756416], 12);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // Free OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    markerClusterGroup = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true
    });
    
    map.addLayer(markerClusterGroup);
}

function initBrandFilters() {
    const container = document.getElementById('brand-filters');
    
    Object.keys(BRANDS).forEach(brand => {
        const { color } = BRANDS[brand];
        
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = brand;
        checkbox.checked = true;
        
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                activeBrands.add(brand);
            } else {
                activeBrands.delete(brand);
            }
            updateMap();
        });
        
        const dot = document.createElement('span');
        dot.className = 'brand-color-dot';
        dot.style.backgroundColor = color;
        
        const text = document.createTextNode(brand);
        
        label.appendChild(checkbox);
        label.appendChild(dot);
        label.appendChild(text);
        
        container.appendChild(label);
    });
}

function loadData() {
    const csvPath = './data/편의점_부산_202606.csv';
    
    Papa.parse(csvPath, {
        download: true,
        header: true,
        dynamicTyping: true,
        encoding: "UTF-8",
        complete: function(results) {
            processData(results.data);
            hideLoading();
        },
        error: function(err) {
            console.error('Error loading CSV:', err);
            alert('데이터를 불러오는데 실패했습니다.');
            hideLoading();
        }
    });
}

function normalizeBrand(name) {
    if (!name) return '기타';
    name = name.toUpperCase();
    
    for (const [brand, info] of Object.entries(BRANDS)) {
        if (brand === '기타') continue;
        if (info.match.some(keyword => name.includes(keyword.toUpperCase()))) {
            return brand;
        }
    }
    return '기타';
}

function processData(data) {
    const regions = new Set();
    
    allStores = data
        .filter(row => row['위도'] && row['경도'] && row['상호명'])
        .map(row => {
            const region = row['시군구명'];
            if (region) regions.add(region);
            
            return {
                name: row['상호명'],
                branch: row['지점명'] || '',
                brand: normalizeBrand(row['상호명']),
                region: region,
                address: row['도로명주소'] || row['지번주소'] || '주소 정보 없음',
                lat: parseFloat(row['위도']),
                lng: parseFloat(row['경도'])
            };
        });

    // Populate region select
    const select = document.getElementById('region-select');
    Array.from(regions).sort().forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        select.appendChild(option);
    });

    updateMap();
}

function createCustomIcon(brand) {
    const color = BRANDS[brand].color;
    
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
            <div style="
                background-color: ${color};
                width: 14px;
                height: 14px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });
}

function updateMap() {
    const selectedRegion = document.getElementById('region-select').value;
    
    markerClusterGroup.clearLayers();
    
    let filteredStores = allStores.filter(store => {
        const matchRegion = selectedRegion === 'all' || store.region === selectedRegion;
        const matchBrand = activeBrands.has(store.brand);
        return matchRegion && matchBrand;
    });

    const markers = [];
    
    filteredStores.forEach(store => {
        const title = store.branch ? `${store.brand} ${store.branch}` : store.name;
        
        const popupContent = `
            <div class="popup-content">
                <h3 style="color: ${BRANDS[store.brand].color}">${title}</h3>
                <p>📍 ${store.address}</p>
                <p>🏢 ${store.region}</p>
            </div>
        `;

        const marker = L.marker([store.lat, store.lng], {
            icon: createCustomIcon(store.brand)
        }).bindPopup(popupContent);
        
        markers.push(marker);
    });

    markerClusterGroup.addLayers(markers);
    
    // Update stats
    document.getElementById('store-count').textContent = filteredStores.length.toLocaleString();

    // Re-center map if specific region is selected and we have markers
    if (selectedRegion !== 'all' && markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
    } else if (selectedRegion === 'all') {
        map.setView([35.1795543, 129.0756416], 12);
    }
}

function hideLoading() {
    const loading = document.getElementById('loading');
    loading.style.opacity = '0';
    setTimeout(() => {
        loading.style.display = 'none';
    }, 500);
}
