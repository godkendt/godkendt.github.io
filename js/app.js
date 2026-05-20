
// 1. Karte initialisieren
const map = L.map('map').setView([47.319, 11.839], 10); // Zentriert auf Deutschland

// 2. Tracestrack Topo Basemap hinzufügen (Aktualisiertes Format)
L.tileLayer('https://tile.tracestrack.com/topo__/{z}/{x}/{y}.webp?key=41ac196b61f7f4000d20c861d54badbf', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.tracestrack.com/">Tracestrack</a>, OpenStreetMap contributors'
}).addTo(map);

// 2a. Hütten-Icon hinzufügen
const hutIcon = L.icon({
    iconUrl: 'images/haus.png',
    // leave out iconSize so the browser uses the image's natural dimensions
    // this preserves the original aspect ratio and avoids stretching
    popupAnchor: [0, -40],
    iconSize: [32, 32] // Optional: Größe des Icons anpassen, falls nötig
});

L.marker([47.364109062135306, 11.83826193824273], { icon: hutIcon })
    .addTo(map)
    .bindPopup('Ferienhaus');

// Restaurant-Icon und Marker hinzufügen
const restaurantIcon = L.icon({
    iconUrl: 'images/restaurant.png',
    // leave out iconSize so the browser uses the image's natural dimensions
    popupAnchor: [0, -30],
    iconSize: [32, 32] // Optional: Größe des Icons anpassen, falls nötig
});

L.marker([47.31927815746927, 11.794698795777782], { icon: restaurantIcon })
    .addTo(map)
    .bindPopup('Jausenstation Geolsalm');

// 3. Modal-Elemente selektieren
const modalOverlay = document.getElementById('modal-overlay');
const modalIframe = document.getElementById('modal-iframe');
const modalClose = document.getElementById('modal-close');

// Modal schließen Event
modalClose.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
    modalIframe.src = ""; // Reset iframe
});

// Sidebar toggle behavior: klappt die Sidebar ein/aus und passt die Karte an
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const routeList = document.getElementById('route-list');
const routeLayers = [];
const routeClickTolerancePx = 10;

function formatRouteName(fileName) {
    return fileName.split('.').slice(0, -1).join(' ');
}

function createRoutePane(index) {
    const paneName = `routePane${index}`;
    if (!map.getPane(paneName)) {
        map.createPane(paneName);
        map.getPane(paneName).style.zIndex = 600 + index;
    }
    return paneName;
}

function addRouteListEntry(fileName, bounds, color) {
    if (!routeList) return;
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = formatRouteName(fileName);
    button.style.border = 'none';
    button.style.background = 'none';
    button.style.color = color;
    button.style.cursor = 'pointer';
    button.style.padding = '0.2em 0';
    button.style.textAlign = 'left';
    button.addEventListener('click', () => {
        if (bounds) map.fitBounds(bounds, { padding: [30, 30] });
        openDescriptionModal(fileName);
    });
    item.appendChild(button);
    routeList.appendChild(item);
}

function flattenLatLngs(latlngs) {
    if (!Array.isArray(latlngs)) return [];
    return latlngs.flatMap(item => {
        if (item instanceof L.LatLng) return [item];
        return flattenLatLngs(item);
    });
}

function isPointNearPolyline(point, polyline, tolerancePx = routeClickTolerancePx) {
    const latlngs = flattenLatLngs(polyline.getLatLngs());
    if (latlngs.length < 2) return false;

    const pointPx = map.latLngToLayerPoint(point);
    for (let i = 0; i < latlngs.length - 1; i++) {
        const a = map.latLngToLayerPoint(latlngs[i]);
        const b = map.latLngToLayerPoint(latlngs[i + 1]);
        const distance = L.LineUtil.pointToSegmentDistance(pointPx, a, b);
        if (distance <= tolerancePx) return true;
    }
    return false;
}

function findRoutesAtLatLng(latlng) {
    return routeLayers
        .filter(route => route.layers.some(layer => isPointNearPolyline(latlng, layer)))
        .sort((a, b) => b.order - a.order); // Topmost route first
}

function showRouteChoicePopup(latlng, matchingRoutes) {
    const container = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = 'Mehrere Strecken hier:';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '0.3em';
    container.appendChild(title);

    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.padding = '0';
    list.style.margin = '0';

    matchingRoutes.forEach(route => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = formatRouteName(route.file);
        button.style.border = '1px solid #ccc';
        button.style.background = route.color;
        button.style.color = '#fff';
        button.style.cursor = 'pointer';
        button.style.marginBottom = '0.3em';
        button.style.width = '100%';
        button.style.padding = '0.35em 0.5em';
        button.addEventListener('click', () => {
            map.closePopup();
            if (route.bounds) map.fitBounds(route.bounds, { padding: [30, 30] });
            openDescriptionModal(route.file);
        });
        item.appendChild(button);
        list.appendChild(item);
    });

    container.appendChild(list);

    L.popup({
        closeOnClick: true,
        autoClose: true,
        className: 'route-choice-popup'
    })
        .setLatLng(latlng)
        .setContent(container)
        .openOn(map);
}

function handleRouteClick(latlng, clickedRoute) {
    const matchingRoutes = findRoutesAtLatLng(latlng);
    if (matchingRoutes.length === 0) {
        openDescriptionModal(clickedRoute.file);
        return;
    }

    if (matchingRoutes.length === 1) {
        const route = matchingRoutes[0];
        if (route.bounds) map.fitBounds(route.bounds, { padding: [30, 30] });
        openDescriptionModal(route.file);
        return;
    }

    showRouteChoicePopup(latlng, matchingRoutes);
}

if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        // Leaflet benötigt ein invalidateSize, damit die Karte korrekt neu gerendert wird
        setTimeout(() => {
            if (map && typeof map.invalidateSize === 'function') map.invalidateSize();
        }, 300);
    });
}

// Geolocation: Button, Marker und Genauigkeitskreis
let locationMarker = null;
let accuracyCircle = null;

function findeStandort() {
    if (!navigator.geolocation) {
        alert("Dein Browser unterstützt keine Geolocation.");
        return;
    }

    navigator.geolocation.getCurrentPosition(success, error, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    });
}

function success(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy || 0;

    if (locationMarker) map.removeLayer(locationMarker);
    if (accuracyCircle) map.removeLayer(accuracyCircle);

    // Blauer Standort-Pin und Popup
    locationMarker = L.marker([lat, lng]).addTo(map)
        .bindPopup("Du bist hier! (Genauigkeit: " + Math.round(accuracy) + " m)").openPopup();

    accuracyCircle = L.circle([lat, lng], { radius: accuracy, color: '#137cbd', opacity: 0.4 }).addTo(map);

    map.setView([lat, lng], 16);
}

function error(err) {
    console.warn(`ERROR(${err.code}): ${err.message}`);
    alert("Standort konnte nicht ermittelt werden. Hast du den Zugriff erlaubt?");
}

const locateBtn = document.getElementById('locate-btn');
if (locateBtn) locateBtn.addEventListener('click', findeStandort);

// Funktion für zufällige helle und sichtbare Farben
function getRandomColor() {
    const hue = Math.floor(Math.random() * 360);
    // Sättigung 70-90%, Helligkeit 45-60% → lebendige, sichtbare Farben
    return `hsl(${hue}, 80%, 50%)`;
}

// Funktion zum Öffnen des Modals basierend auf dem Dateinamen
function openDescriptionModal(fileName) {
    // Extrahiert den reinen Namen ohne Endung (z.B. "route1.geojson" -> "route1")
    const baseName = fileName.split('.').slice(0, -1).join('.');
    modalIframe.src = `descriptions/${baseName}.html`;
    modalOverlay.classList.remove('hidden');
}

// 4. Features aus der JSON-Steuerungsdatei laden
fetch('data/features.json')
    .then(response => response.json())
    .then(files => {
        files.forEach((file, index) => {
            const fileUrl = `data/${file}`;
            
            if (file.endsWith('.geojson')) {
                // GeoJSON laden
                fetch(fileUrl)
                    .then(res => res.json())
                    .then(geojsonData => {
                        L.geoJSON(geojsonData, {
                            onEachFeature: function (feature, layer) {
                                layer.on('click', () => openDescriptionModal(file));
                            }
                        }).addTo(map);
                    });
            } else if (file.endsWith('.gpx')) {
                // GPX laden mittels Plugin mit zufälliger Farbe
                const randomColor = getRandomColor();
                const routeOrder = index;
                const paneName = createRoutePane(routeOrder);
                const routeInfo = {
                    file,
                    bounds: null,
                    color: randomColor,
                    layers: [],
                    order: routeOrder
                };
                routeLayers.push(routeInfo);

                new L.GPX(fileUrl, {
                    async: true,
                    marker_options: {
                        startIconUrl: null,
                        endIconUrl: null,
                        shadowUrl: null
                    },
                    polyline_options: {
                        pane: paneName,
                        color: randomColor,
                        weight: 4,
                        opacity: 0.85
                    }
                }).on('loaded', function(e) {
                    const gpxLayer = e.target;
                    const bounds = gpxLayer.getBounds ? gpxLayer.getBounds() : null;
                    routeInfo.bounds = bounds;
                    const routeName = formatRouteName(file);

                    gpxLayer.eachLayer(layer => {
                        if (layer instanceof L.Polyline) {
                            routeInfo.layers.push(layer);
                            layer.setStyle({ color: randomColor, weight: 4, opacity: 0.85 });
                            layer.on('click', e => handleRouteClick(e.latlng, routeInfo));
                            layer.bindTooltip(routeName, {
                                direction: 'center',
                                permanent: false,
                                opacity: 0.8,
                                className: 'route-tooltip'
                            });

                            // Extra breites Klickfeld für die Route
                            const hitArea = L.polyline(layer.getLatLngs(), {
                                pane: paneName,
                                color: randomColor,
                                weight: 18,
                                opacity: 0,
                                interactive: true
                            }).addTo(map);
                            hitArea.on('click', e => handleRouteClick(e.latlng, routeInfo));
                            if (typeof hitArea.bringToFront === 'function') {
                                hitArea.bringToFront();
                            }
                        }
                    });

                    addRouteListEntry(file, bounds, randomColor);
                    if (typeof gpxLayer.bringToFront === 'function') {
                        gpxLayer.bringToFront();
                    }
                }).addTo(map);
            }
        });
    })
    .catch(err => console.error("Fehler beim Laden der Feature-Liste:", err));