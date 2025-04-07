document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const pokemonListContainer = document.getElementById('pokemonList');
    const searchInput = document.getElementById('searchInput');
    const loader = document.getElementById('loader');
    const modal = document.getElementById('pokemonDetailModal');
    const modalContent = document.getElementById('pokemonDetailContent');
    const closeModalButton = document.getElementById('closeModalButton');
    const yearSpan = document.getElementById('copyright-year');
    
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear(); // Use current year
    }

    // --- API & State Variables ---
    const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2/';
    const POKEMON_SPRITE_URL_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
    const LOAD_LIMIT = 50; // Number of Pokémon to load per batch
    let currentOffset = 0;
    let isLoading = false;
    let allPokemonNameList = []; // To store { name: '...', url: '...' } for searching
    let detailCache = {}; // Cache for fetched Pokémon details
    let searchTimeout; // For debouncing search input
    let isEndOfList = false; // Flag to indicate if all Pokemon have been loaded

    // --- Functions ---

    // Debounce function
    function debounce(func, delay) {
        return function(...args) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // Generic API fetch function
    async function fetchApiData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                 // Handle 404 specifically for detail fetching if needed
                if (response.status === 404) {
                    console.warn(`Resource not found: ${url}`);
                    return null; // Indicate not found clearly
                }
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Error fetching data:", error);
            // Avoid showing generic error for every single 404 on detail fetch maybe
            if (!url.includes('/pokemon/')) { // Show error primarily for list fetching
                 showError(`Failed to fetch data. Check connection.`);
            }
            return null; // Indicate failure
        }
    }

    // Fetch details for a single Pokémon (with caching)
    async function getPokemonDetails(url) {
        if (detailCache[url]) {
            return detailCache[url]; // Return cached data
        }
        // No need for separate isLoading flag here, modal loader handles UX
        showModalLoader();
        const data = await fetchApiData(url);
        if (data) {
            detailCache[url] = data; // Cache successful fetch
        }
        return data; // Return data or null if fetch failed/404
    }

    // Create HTML for a Pokémon card
    function createPokemonCard(pokemon) {
        const card = document.createElement('div');
        card.classList.add('pokemon-card');
        card.dataset.url = pokemon.url; // Store the detail URL

        const pokemonIdMatch = pokemon.url.match(/\/(\d+)\/?$/); // Extract ID from URL robustly
        if (!pokemonIdMatch) return null; // Skip if ID cannot be extracted
        const pokemonId = pokemonIdMatch[1];

        const spriteUrl = `${POKEMON_SPRITE_URL_BASE}${pokemonId}.png`;

        card.innerHTML = `
            <div class="pokemon-id">#${pokemonId.padStart(3, '0')}</div>
            <img src="${spriteUrl}" alt="${pokemon.name}" loading="lazy" onerror="this.style.display='none'; this.onerror=null;"> <div class="pokemon-name">${pokemon.name}</div>
        `;

        // Click listener for details
        card.addEventListener('click', async () => {
            const detailUrl = card.dataset.url;
            modal.style.display = 'flex'; // Show modal immediately
            showModalLoader(); // Show loader inside modal content
            const detailedData = await getPokemonDetails(detailUrl);
            if (detailedData) {
                displayPokemonDetails(detailedData);
            } else {
                // Handle case where details couldn't be fetched (e.g., 404 for specific forms)
                showError("Could not load details for this Pokémon.", modalContent);
            }
        });
        return card;
    }

    // Append Pokémon cards to the list
    function displayPokemonList(pokemonArray, clearExisting = false) {
         if (clearExisting) {
             pokemonListContainer.innerHTML = ''; // Clear for search results
         }

         if (!pokemonArray || pokemonArray.length === 0) {
             if (pokemonListContainer.children.length === 0) { // Show only if list is empty
                pokemonListContainer.innerHTML = '<p class="loader">No Pokémon found.</p>';
             }
             return;
         }
         // Use a DocumentFragment for performance when adding many elements
         const fragment = document.createDocumentFragment();
         pokemonArray.forEach(pokemon => {
            // Prevent adding duplicates if somehow fetched again (relevant for non-clearing adds)
            if (!clearExisting && pokemonListContainer.querySelector(`[data-url="${pokemon.url}"]`)) {
                return; // Skip duplicate
            }
            const card = createPokemonCard(pokemon);
            if (card) { // Add card only if successfully created
                 fragment.appendChild(card);
            }
        });
        pokemonListContainer.appendChild(fragment);
    }

    // Display detailed info in the modal
    function displayPokemonDetails(pokemon) {
        if (!pokemon) {
             showError("Pokémon details unavailable.", modalContent);
             return;
         }

        const pokemonId = pokemon.id;
        const pokemonName = pokemon.name;
        const encodedName = encodeURIComponent(pokemonName);

        // --- Updated Sprite Logic ---
        const animatedSpriteUrl = pokemon.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default;
        const officialArtUrl = pokemon.sprites?.other?.['official-artwork']?.front_default;
        const defaultSpriteUrl = pokemon.sprites?.front_default;
        const backupSpriteUrl = `${POKEMON_SPRITE_URL_BASE}${pokemonId}.png`;
        const spriteUrl = animatedSpriteUrl ?? officialArtUrl ?? defaultSpriteUrl ?? backupSpriteUrl;
        // --- End of Updated Sprite Logic ---


        const typesHtml = pokemon.types.map(typeInfo =>
            `<span class="type-${typeInfo.type.name}">${typeInfo.type.name}</span>`
        ).join('');

        const maxStatValue = 255; // Approx max for scaling
        const statsHtml = pokemon.stats.map(statInfo => {
            const statName = statInfo.stat.name.replace('special-', 'sp. ');
            const statValue = statInfo.base_stat;
            const statPercentage = Math.min(100, (statValue / maxStatValue) * 100); // Cap at 100% visually
             return `
                <p>
                    <strong>${statName}:</strong>
                    <span>${statValue}</span>
                    <div class="stat-bar-container">
                        <div class="stat-bar" style="width: ${statPercentage}%; background-color: ${getStatColor(statValue)};"></div>
                    </div>
                </p>
            `;
        }).join('');

        const abilities = pokemon.abilities.map(a => a.ability.name.replace('-', ' ')).join(', ');
        const height = (pokemon.height / 10).toFixed(1);
        const weight = (pokemon.weight / 10).toFixed(1);

        // Pricing links section
        const priceHtml = `
            <div class="price-info">
                <p><i>Check current market prices:</i></p>
                <a href="https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodedName}&view=grid" target="_blank" rel="noopener noreferrer">TCGplayer</a> |
                <a href="https://www.ebay.com/sch/i.html?_nkw=pokemon+${encodedName}+card" target="_blank" rel="noopener noreferrer">eBay (Cards)</a> |
                <a href="https://www.ebay.com/sch/i.html?_nkw=pokemon+${encodedName}" target="_blank" rel="noopener noreferrer">eBay (Merch)</a>
            </div>`;

        modalContent.innerHTML = `
            <h2>${pokemonName} (#${pokemonId.toString().padStart(3, '0')})</h2>
            <img src="${spriteUrl}" alt="${pokemonName}" onerror="this.onerror=null; this.src='${backupSpriteUrl}';"> <div class="pokemon-types">${typesHtml}</div>
            <p>Height: ${height} m | Weight: ${weight} kg</p>
            <p><strong>Abilities:</strong> ${abilities}</p>
            <div class="pokemon-stats">
                <h3>Base Stats</h3>
                ${statsHtml}
            </div>
            ${priceHtml}
        `;
    }

    // Helper for stat bar color
    function getStatColor(value) {
        if (value < 60) return '#EF5350'; // Red lower threshold
        if (value < 90) return '#FFAC33'; // Orange
        if (value < 110) return '#FFEB3B'; // Yellow
        if (value < 140) return '#7AC74C'; // Green
        return '#2196F3'; // Blue for high stats
    }

    // Show loader function
    function showLoader(show = true) {
        loader.style.display = show ? 'block' : 'none';
    }
    function showModalLoader() {
         modalContent.innerHTML = '<div class="loader">Loading details...</div>';
    }

    // Display error message
    function showError(message, container = pokemonListContainer) {
        if (container === pokemonListContainer) {
             // Show error below existing cards if possible, or replace if empty
             if (container.children.length > 0 && !container.querySelector('.error-message')) {
                const errorP = document.createElement('p');
                errorP.className = 'loader error-message'; // Use loader style
                errorP.style.color = 'red';
                errorP.textContent = message;
                container.appendChild(errorP);
             } else if (container.children.length === 0) {
                 container.innerHTML = `<p class="loader" style="color: red;">${message}</p>`;
             }
        } else if (container === modalContent) {
             container.innerHTML = `<p class="loader" style="color: red;">${message}</p>`;
        }
         console.error(message); // Log error for debugging
    }


    // Load a batch of Pokémon
    async function loadPokemon(clearExisting = false) {
        if (isLoading || isEndOfList) return; // Prevent multiple loads or loading past end
        isLoading = true;
        showLoader(true);

        const url = `${POKEAPI_BASE_URL}pokemon?limit=${LOAD_LIMIT}&offset=${currentOffset}`;
        const data = await fetchApiData(url);

        if (data && data.results) {
            displayPokemonList(data.results, clearExisting);
            currentOffset += data.results.length; // Increment offset by actual results length
            isEndOfList = !data.next; // Check if there's a next page
             if (isEndOfList) {
                console.log("Reached the end of the Pokémon list.");
                loader.textContent = "No more Pokémon to load.";
                // Keep loader visible with the message
             }
        } else {
             // Error handled in fetchApiData generally
             if (!isEndOfList) { // Only show load error if not already at the end
                 showError("Could not load more Pokémon.", loader);
             }
        }

        // Hide loader only if not at the end, otherwise keep the 'end' message
        if (!isEndOfList) {
            showLoader(false);
        }
        isLoading = false;
    }

     // Fetch all Pokémon names for searching
     async function fetchAllPokemonNames() {
        // Fetching all names might take a moment
        // PokéAPI now supports higher limits, but let's cap reasonably
        const MAX_POKEMON_COUNT = 1302; // Approximate current count
        const url = `${POKEAPI_BASE_URL}pokemon?limit=${MAX_POKEMON_COUNT}&offset=0`;
        console.log("Fetching full Pokémon list for search...");
        const data = await fetchApiData(url);
        if (data && data.results) {
            allPokemonNameList = data.results;
            console.log(`Workspaceed ${allPokemonNameList.length} Pokémon names for search.`);
        } else {
            console.error("Failed to fetch the full Pokémon list for searching.");
            searchInput.placeholder = "Search unavailable"; // Update placeholder
            searchInput.disabled = true; // Disable search if list fetch fails
        }
    }


    // Handle search input
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();

        // Clear previous error messages when searching
         const existingError = pokemonListContainer.querySelector('.error-message');
         if (existingError) existingError.remove();

        // Clear existing list content before showing search results
        pokemonListContainer.innerHTML = '';
        isEndOfList = true; // Disable infinite scroll during search display
        showLoader(false); // Hide infinite scroll loader

        if (!searchTerm) {
            currentOffset = 0; // Reset offset
            isEndOfList = false; // Re-enable infinite scroll
            loadPokemon(true); // Load initial batch again (clearing list)
            return;
        }

        // Filter the pre-fetched full list
        const filteredPokemon = allPokemonNameList.filter(pokemon => {
            const pokemonId = pokemon.url.match(/\/(\d+)\/?$/)?.[1]; // Extract ID safely
            return pokemon.name.toLowerCase().includes(searchTerm) || pokemonId === searchTerm;
        });

        if (filteredPokemon.length > 0) {
            displayPokemonList(filteredPokemon, true); // Display search results (clearing list)
        } else {
             pokemonListContainer.innerHTML = '<p class="loader">No Pokémon found matching your search.</p>';
        }
    }

    // --- Event Listeners ---

    // Infinite Scroll Listener
    pokemonListContainer.addEventListener('scroll', () => {
        // Check if search is active or if already loading or at end - if so, disable infinite scroll
        if (searchInput.value.trim() || isLoading || isEndOfList) {
            return;
        }
        // Threshold check
        const { scrollTop, scrollHeight, clientHeight } = pokemonListContainer;
        if (scrollHeight - scrollTop - clientHeight < 200 && !isLoading) { // Load slightly earlier
            console.log("Near bottom, loading more...");
            loadPokemon();
        }
    });

    // Search Input Listener (debounced)
    searchInput.addEventListener('input', debounce(handleSearch, 400)); // 400ms debounce

    // Modal Close Listeners
    closeModalButton.addEventListener('click', () => {
        modal.style.display = 'none';
        modalContent.innerHTML = ''; // Clear content when closing
    });
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
            modalContent.innerHTML = ''; // Clear content when closing
        }
    });

    // --- Initial Load ---
    async function initializePokedex() {
        showLoader(true); // Show loader immediately
        pokemonListContainer.innerHTML = ''; // Clear any static content/previous loader
        await fetchAllPokemonNames(); // Fetch names for search first
        await loadPokemon(); // Load the first batch
        // Loader is hidden inside loadPokemon if not at the end
    }

    initializePokedex();
});