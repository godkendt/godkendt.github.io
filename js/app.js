// 1. Karte initialisieren
const map = L.map('map').setView([51.1657, 10.4515], 6); // Zentriert auf Deutschland

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
    popupAnchor: [0, -40]
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
        files.forEach(file => {
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
                // GPX laden mittels Plugin
                new L.GPX(fileUrl, {
                    async: true,
                    marker_options: {
                        startIconUrl: null, // Verhindert standardmäßige Start/End-Pins falls nicht gewünscht
                        endIconUrl: null,
                        shadowUrl: null
                    }
                }).on('loaded', function(e) {
                    // GPX-Tracks sind FeatureGroups, wir hängen den Klick-Event an die Gruppe
                    e.target.on('click', () => openDescriptionModal(file));
                }).addTo(map);
            }
        });
    })
    .catch(err => console.error("Fehler beim Laden der Feature-Liste:", err));