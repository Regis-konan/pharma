
    // Messages à taper
    const messages = [
      "Bienvenue sur PharmaConnect, votre service de localisation de pharmacies.",
      "Nous pouvons trouver les pharmacies les plus proches de votre position actuelle.",
      "Souhaitez-vous que nous recherchions les pharmacies disponibles autour de vous ?"
    ];
    
    let currentMessageIndex = 0;
    let currentCharIndex = 0;
    let typingTimeout;

    // Fonction pour obtenir le message de salutation selon l'heure
    function getGreeting() {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return 'Bonjour';
      if (hour >= 12 && hour < 18) return 'Bon après-midi';
      if (hour >= 18 && hour < 22) return 'Bonsoir';
      return 'Bonne soirée';
    }

    // Fonction de typing animation
    function typeMessage() {
      const typingElement = document.getElementById('typing-message');
      const currentMessage = messages[currentMessageIndex];
      
      if (currentCharIndex < currentMessage.length) {
        typingElement.innerHTML = currentMessage.substring(0, currentCharIndex + 1) + '<span class="typing-cursor"></span>';
        currentCharIndex++;
        typingTimeout = setTimeout(typeMessage, 30);
      } else {
        // Message terminé
        typingElement.innerHTML = currentMessage;
        
        if (currentMessageIndex < messages.length - 1) {
          // Passer au message suivant
          currentMessageIndex++;
          currentCharIndex = 0;
          typingTimeout = setTimeout(() => {
            typingElement.innerHTML += '<br><br>';
            typeMessage();
          }, 500);
        } else {
          // Tous les messages sont terminés, afficher les boutons
          setTimeout(() => {
            document.getElementById('choice-buttons').style.opacity = '1';
            document.getElementById('choice-buttons').style.animation = 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
          }, 300);
        }
      }
    }

    // Initialiser au chargement
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('greeting').textContent = getGreeting();
      setTimeout(() => {
        typeMessage();
      }, 800);
    });

    // Navigation entre les écrans
    function startSearch() {
      clearTimeout(typingTimeout);
      document.getElementById('welcome-screen').classList.add('hide');
      document.getElementById('search-screen').style.display = 'block';
      setTimeout(() => {
        findPharmacies();
      }, 300);
    }

    function declineSearch() {
      clearTimeout(typingTimeout);
      document.getElementById('welcome-screen').classList.add('hide');
      document.getElementById('goodbye-screen').classList.add('show');
    }

    function backToHome() {
      document.getElementById('goodbye-screen').classList.remove('show');
      document.getElementById('goodbye-screen').style.display = 'none';
      document.getElementById('search-screen').style.display = 'none';
      document.getElementById('welcome-screen').classList.remove('hide');
      document.getElementById('greeting').textContent = getGreeting();
      
      // Réinitialiser et relancer l'animation de typing
      currentMessageIndex = 0;
      currentCharIndex = 0;
      document.getElementById('typing-message').innerHTML = '';
      document.getElementById('choice-buttons').style.opacity = '0';
      
      setTimeout(() => {
        typeMessage();
      }, 500);
    }

    function exitSearch() {
      if (confirm('Voulez-vous vraiment quitter la recherche ?')) {
        backToHome();
        pharmacyList.innerHTML = '';
        retryButton.style.display = 'none';
        currentRadiusIndex = 0;
      }
    }

    // Éléments DOM
    const statusElement = document.getElementById('status');
    const statusMessage = document.getElementById('status-message');
    const loadingElement = document.getElementById('loading');
    const pharmacyList = document.getElementById('pharmacy-list');
    const retryButton = document.getElementById('retry-button');

    // Rayons de recherche (en mètres)
    const SEARCH_RADIUS = [500, 1000, 2000, 3000, 5000];
    let currentRadiusIndex = 0;

    // Fonction principale
    async function findPharmacies() {
      showStatus('Demande d\'accès à votre position...', true);
      
      try {
        const position = await getPosition();
        const { latitude: lat, longitude: lng } = position.coords;
        
        showStatus('Position obtenue. Recherche des pharmacies...', true);
        
        let pharmacies = [];
        currentRadiusIndex = 0;
        
        while (currentRadiusIndex < SEARCH_RADIUS.length && pharmacies.length === 0) {
          const radius = SEARCH_RADIUS[currentRadiusIndex];
          showStatus(`Analyse dans un rayon de ${radius}m...`, true);
          
          pharmacies = await searchPharmacies(lat, lng, radius);
          
          if (pharmacies.length === 0) {
            currentRadiusIndex++;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        if (pharmacies.length > 0) {
          showStatus(`${pharmacies.length} pharmacie(s) trouvée(s)`, false);
          displayPharmacies(pharmacies, lat, lng);
          retryButton.style.display = 'inline-flex';
        } else {
          showStatus('Aucune pharmacie trouvée', false);
          showNoPharmacies();
          retryButton.style.display = 'inline-flex';
        }
        
      } catch (error) {
        console.error('Erreur:', error);
        showStatus('Impossible d\'accéder à votre position', false);
        showError();
        retryButton.style.display = 'inline-flex';
      }
    }

    function getPosition() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Géolocalisation non supportée'));
          return;
        }
        
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
    }

    async function searchPharmacies(lat, lng, radius) {
      try {
        const query = `
          [out:json];
          node["amenity"="pharmacy"](around:${radius},${lat},${lng});
          out body;
        `;
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query,
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
          throw new Error('Erreur API');
        }
        
        const data = await response.json();
        return data.elements || [];
        
      } catch (error) {
        console.log('Erreur recherche:', error);
        return [];
      }
    }

    function displayPharmacies(pharmacies, userLat, userLng) {
      pharmacyList.innerHTML = '';
      
      pharmacies.sort((a, b) => {
        const distA = getDistance(userLat, userLng, a.lat, a.lon);
        const distB = getDistance(userLat, userLng, b.lat, b.lon);
        return distA - distB;
      });
      
      const displayPharmacies = pharmacies.slice(0, 5);
      
      displayPharmacies.forEach((pharmacy, index) => {
        const distance = getDistance(userLat, userLng, pharmacy.lat, pharmacy.lon);
        const name = pharmacy.tags?.name || 'Pharmacie';
        
        const card = document.createElement('div');
        card.className = 'pharmacy-card';
        card.style.animationDelay = `${index * 0.1}s`;
        
        card.innerHTML = `
          <div class="pharmacy-header">
            <div class="pharmacy-icon-container">
              <svg class="pharmacy-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.5 2.5H13.5L14 5H10L10.5 2.5Z" fill="currentColor"/>
                <path d="M19 8H5C3.89543 8 3 8.89543 3 10V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V10C21 8.89543 20.1046 8 19 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 13V17M10 15H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="pharmacy-info">
              <div class="pharmacy-name">${name}</div>
              <div class="pharmacy-distance">
                <svg class="distance-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="currentColor"/>
                </svg>
                ${distance.toFixed(1)} km
              </div>
            </div>
          </div>
          <button class="go-button" onclick="goToPharmacy(${pharmacy.lat}, ${pharmacy.lon}, '${name.replace(/'/g, "\\'")}')">
            Obtenir l'itinéraire
            <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        `;
        
        pharmacyList.appendChild(card);
      });
    }

    function goToPharmacy(lat, lng, name) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&destination_name=${encodeURIComponent(name)}`;
      window.open(url, '_blank');
    }

    function getDistance(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    function showStatus(message, isLoading) {
      statusMessage.textContent = message;
      loadingElement.style.display = isLoading ? 'block' : 'none';
    }

    function showNoPharmacies() {
      pharmacyList.innerHTML = `
        <div class="no-pharmacies">
          <svg class="no-pharmacies-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#CBD5E0" stroke-width="2"/>
            <path d="M12 8V12" stroke="#CBD5E0" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="16" r="1" fill="#CBD5E0"/>
          </svg>
          <p>Aucune pharmacie trouvée</p>
          <p class="subtitle">Essayez d'élargir la zone de recherche ou vérifiez votre position</p>
        </div>
      `;
    }

    function showError() {
      pharmacyList.innerHTML = `
        <div class="no-pharmacies">
          <svg class="no-pharmacies-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#F56565" stroke-width="2"/>
            <path d="M15 9L9 15M9 9L15 15" stroke="#F56565" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p>Erreur de localisation</p>
          <p class="subtitle">Vérifiez que vous avez autorisé l'accès à votre position</p>
        </div>
      `;
    }

    function retrySearch() {
      currentRadiusIndex = 0;
      pharmacyList.innerHTML = '';
      retryButton.style.display = 'none';
      findPharmacies();
    }
