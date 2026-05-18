// 1. Karte initialisieren
const map = L.map('map').setView([51.1657, 10.4515], 6); // Zentriert auf Deutschland

// 2. Tracestrack Topo Basemap hinzufügen
// Hinweis: Tracestrack benötigt oft einen API-Key für produktiven Traffic.
L.tileLayer('https://tile.tracestrack.com/topo__/10/511/341.webp?key=41ac196b61f7f4000d20c861d54badbf', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.tracestrack.com/">Tracestrack</a>, OpenStreetMap contributors'
}).addTo(map);

// 3. Modal-Elemente selektieren
const modalOverlay = document.getElementById('modal-overlay');
const modalIframe = document.getElementById('modal-iframe');
const modalClose = document.getElementById('modal-close');

// Modal schließen Event
modalClose.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
    modalIframe.src = ""; // Reset iframe
});

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