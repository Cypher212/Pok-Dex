document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const pokemonListContainer = document.getElementById('pokemonList');
    const searchInput = document.getElementById('searchInput');
    const loader = document.getElementById('loader');
    const modal = document.getElementById('pokemonDetailModal');
    const modalContent = document.getElementById('pokemonDetailContent');
    const closeModalButton = document.getElementById('closeModalButton');
    const yearSpan = document.getElementById('copyright-year'); // Get reference to the year span

    // --- Set current year in footer ---
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear(); // Use current year (2025 based on context)
    }
    // --- End of setting year ---


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


    // --- Hardcoded TCG Set List (Comprehensive as of approx Apr 2025) ---
    const commonTcgSets = [
        "SV: Scarlet & Violet 151", "Aquapolis", "Arceus", "Astral Radiance", "Base Set", "Base Set 2", "Battle Styles",
        "Black & White", "Boundaries Crossed", "BREAKpoint", "BREAKthrough", "Brilliant Stars",
        "Burning Shadows", "Call of Legends", "Celebrations", "Celestial Storm", "Champion's Path",
        "Chilling Reign", "Cosmic Eclipse", "Crimson Invasion", "Crown Zenith", "Crystal Guardians",
        "Dark Explorers", "Darkness Ablaze", "Deoxys", "Delta Species", "Detective Pikachu",
        "Diamond & Pearl", "Double Crisis", "Dragon", "Dragon Frontiers", "Dragon Majesty",
        "Dragon Vault", "Dragons Exalted", "Emerald", "Emerging Powers", "Evolving Skies",
        "Evolutions", "EX FireRed & LeafGreen", "EX Hidden Legends", "EX Holon Phantoms",
        "EX Legend Maker", "EX Power Keepers", "EX Ruby & Sapphire", "EX Sandstorm",
        "EX Team Magma vs Team Aqua", "EX Team Rocket Returns", "EX Unseen Forces",
        "Expedition Base Set", "Fates Collide", "Flashfire", "Forbidden Light", "Fossil",
        "Fusion Strike", "Furious Fists", "Generations", "Great Encounters", "Guardians Rising",
        "Gym Challenge", "Gym Heroes", "HeartGold & SoulSilver", "Hidden Fates", "Jungle",
        "Kalos Starter Set",
        "Legendary Collection", "Legendary Treasures", "Legends Awakened", "Lost Origin",
        "Lost Thunder", "Majestic Dawn", "McDonald's Collection 2011", "McDonald's Collection 2012",
        "McDonald's Collection 2013", "McDonald's Collection 2014", "McDonald's Collection 2015",
        "McDonald's Collection 2016", "McDonald's Collection 2017", "McDonald's Collection 2018",
        "McDonald's Collection 2019", "McDonald's Collection 2021", "McDonald's Collection 2022",
        "McDonald's Collection 2023", "McDonald's Collection 2024",
        "Mysterious Treasures", "Neo Destiny", "Neo Discovery", "Neo Genesis", "Neo Revelation",
        "Next Destinies", "Noble Victories", "Obsidian Flames", "Paldea Evolved", "Paldean Fates",
        "Paradox Rift", "Phantom Forces", "Plasma Blast", "Plasma Freeze", "Plasma Storm",
        "Platinum", "Pokemon GO", "POP Series 1", "POP Series 2", "POP Series 3", "POP Series 4",
        "POP Series 5", "POP Series 6", "POP Series 7", "POP Series 8", "POP Series 9",
        "Primal Clash", "Rebel Clash", "Rising Rivals", "Roaring Skies", "Scarlet & Violet",
        "Secret Wonders", "Shining Fates", "Shining Legends", "Silver Tempest", "Skyridge",
        "Steam Siege", "Stormfront", "Sun & Moon", "Supreme Victors", "Sword & Shield",
        "Team Rocket", "Team Up", "Temporal Forces", "Triumphant", "Twilight Masquerade",
        "Ultra Prism", "Unbroken Bonds", "Undaunted", "Unified Minds", "Unleashed",
        "Vivid Voltage", "XY"
    ].sort(); // Keep alphabetized
    // --- End of Set List ---


    console.log('Pokedex script loaded.'); // Log script start

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
                if (response.status === 404) { console.warn(`Resource not found: ${url}`); return null; }
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Error fetching data:", error);
            return null;
        }
    }

    // Fetch details for a single Pokémon (with caching)
    async function getPokemonDetails(url) {
        if (detailCache[url]) { console.log(`Cache hit for: ${url}`); return detailCache[url]; }
        console.log(`Workspaceing details for: ${url}`);
        showModalLoader();
        const data = await fetchApiData(url);
        if (data) { detailCache[url] = data; }
        return data;
    }

    // Create HTML for a Pokémon card
    function createPokemonCard(pokemon) {
        const card = document.createElement('div');
        card.classList.add('pokemon-card');
        card.dataset.url = pokemon.url;
        const pokemonIdMatch = pokemon.url.match(/\/(\d+)\/?$/);
        if (!pokemonIdMatch) { console.warn(`Could not extract ID from URL: ${pokemon.url}`); return null; }
        const pokemonId = pokemonIdMatch[1];
        const spriteUrl = `${POKEMON_SPRITE_URL_BASE}${pokemonId}.png`;
        card.innerHTML = `
            <div class="pokemon-id">#${pokemonId.padStart(3, '0')}</div>
            <img src="${spriteUrl}" alt="${pokemon.name}" loading="lazy" onerror="this.style.display='none'; this.onerror=null;">
            <div class="pokemon-name">${pokemon.name}</div>
        `;
        card.addEventListener('click', async () => {
            console.log(`Card clicked: ${pokemon.name}`);
            const detailUrl = card.dataset.url;
            modal.style.display = 'flex';
            showModalLoader();
            const detailedData = await getPokemonDetails(detailUrl);
            if (detailedData) { displayPokemonDetails(detailedData); }
            else { showError("Could not load details for this Pokémon.", modalContent); }
        });
        return card;
    }

    // Append Pokémon cards to the list
    function displayPokemonList(pokemonArray, clearExisting = false) {
         if (clearExisting) { console.log('Clearing existing list for new display.'); pokemonListContainer.innerHTML = ''; }
         if (!pokemonArray || pokemonArray.length === 0) {
             if (pokemonListContainer.children.length === 0) { console.log('No Pokémon to display, showing empty message.'); pokemonListContainer.innerHTML = '<p class="loader">No Pokémon found.</p>'; }
             return;
         }
         console.log(`Displaying ${pokemonArray.length} Pokémon cards.`);
         const fragment = document.createDocumentFragment();
         pokemonArray.forEach(pokemon => {
            if (!clearExisting && pokemonListContainer.querySelector(`[data-url="${pokemon.url}"]`)) { console.log(`Skipping duplicate: ${pokemon.name}`); return; }
            const card = createPokemonCard(pokemon);
            if (card) { fragment.appendChild(card); }
        });
        pokemonListContainer.appendChild(fragment);
    }

    // Display detailed info in the modal
    function displayPokemonDetails(pokemon) {
        if (!pokemon) { showError("Pokémon details unavailable.", modalContent); return; }
        console.log(`Displaying details for: ${pokemon.name}`);
        const pokemonId = pokemon.id;
        const pokemonName = pokemon.name; // Store for use in button listener
        const encodedPokemonName = encodeURIComponent(pokemonName);
        const animatedSpriteUrl = pokemon.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default;
        const officialArtUrl = pokemon.sprites?.other?.['official-artwork']?.front_default;
        const defaultSpriteUrl = pokemon.sprites?.front_default;
        const backupSpriteUrl = `${POKEMON_SPRITE_URL_BASE}${pokemonId}.png`;
        const spriteUrl = animatedSpriteUrl ?? officialArtUrl ?? defaultSpriteUrl ?? backupSpriteUrl;
        const typesHtml = pokemon.types.map(typeInfo => `<span class="type-${typeInfo.type.name}">${typeInfo.type.name}</span>`).join('');
        const maxStatValue = 255;
        const statsHtml = pokemon.stats.map(statInfo => {
            const statName = statInfo.stat.name.replace('special-', 'sp. '); const statValue = statInfo.base_stat;
            const statPercentage = Math.min(100, (statValue / maxStatValue) * 100);
            return `<p><strong>${statName}:</strong><span>${statValue}</span><div class="stat-bar-container"><div class="stat-bar" style="width: ${statPercentage}%; background-color: ${getStatColor(statValue)};"></div></div></p>`;
        }).join('');
        const abilities = pokemon.abilities.map(a => a.ability.name.replace('-', ' ')).join(', ');
        const height = (pokemon.height / 10).toFixed(1);
        const weight = (pokemon.weight / 10).toFixed(1);

        // TCG Set Search UI
        const tcgSetSearchHtml = `
            <div class="tcg-set-search">
                <label for="tcgSetSelect">Check TCG Card Price (by Set):</label>
                <div class="tcg-controls">
                     <select id="tcgSetSelect">
                         <option value="">-- Select a Set --</option>
                         ${commonTcgSets.map(set => `<option value="${encodeURIComponent(set)}">${set}</option>`).join('')} {/* Encode set name value */}
                     </select>
                     <button id="tcgSearchButton">Search TCGplayer</button>
                </div>
                <p class="tcg-note"><i>Note: Set list includes common sets, may not be exhaustive.</i></p>
            </div>
        `;

        // Original Pricing Links
        const priceHtml = `
            <div class="price-info">
                <p><i>General Price Check Links:</i></p>
                <a href="https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodedPokemonName}&view=grid" target="_blank" rel="noopener noreferrer">TCGplayer (All)</a> |
                <a href="https://www.pricecharting.com/search-products?q=pokemon+${encodedPokemonName}&type=prices" target="_blank" rel="noopener noreferrer">PriceCharting</a> |
                <a href="https://www.ebay.com/sch/i.html?_nkw=pokemon+${encodedPokemonName}+card" target="_blank" rel="noopener noreferrer">eBay</a>
            </div>`;

        // Combine and Set Modal Content
        modalContent.innerHTML = `
            <h2>${pokemonName} (#${pokemonId.toString().padStart(3, '0')})</h2>
            <img src="${spriteUrl}" alt="${pokemonName}" onerror="this.onerror=null; this.src='${backupSpriteUrl}';">
            <div class="pokemon-types">${typesHtml}</div>
            <p>Height: ${height} m | Weight: ${weight} kg</p>
            <p><strong>Abilities:</strong> ${abilities}</p>
            <div class="pokemon-stats">
                <h3>Base Stats</h3>
                ${statsHtml}
            </div>
            ${tcgSetSearchHtml}
            ${priceHtml}
        `;

        // Add Event Listener for the new TCG Search Button
        const tcgSearchButton = modalContent.querySelector('#tcgSearchButton');
        const tcgSetSelect = modalContent.querySelector('#tcgSetSelect');
        if (tcgSearchButton && tcgSetSelect) {
            tcgSearchButton.addEventListener('click', () => {
                const selectedEncodedSetName = tcgSetSelect.value; // Value is already encoded
                if (!selectedEncodedSetName) { alert('Please select a TCG set first.'); return; }
                // Construct the specific search URL
                // Note: TCGplayer search keys might change, this format works generally
                const tcgUrl = `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodedPokemonName}&setName=${selectedEncodedSetName}&view=grid&page=1`;
                console.log(`Opening TCGplayer search: ${tcgUrl}`);
                window.open(tcgUrl, '_blank', 'noopener,noreferrer');
            });
        } else { console.error("Could not find TCG search button or select element."); }
    }


    // Helper for stat bar color
    function getStatColor(value) {
        if (value < 60) return '#EF5350'; if (value < 90) return '#FFAC33'; if (value < 110) return '#FFEB3B'; if (value < 140) return '#7AC74C'; return '#2196F3';
    }

    // Show loader function
    function showLoader(show = true) { loader.style.display = show ? 'block' : 'none'; }
    function showModalLoader() { modalContent.innerHTML = '<div class="loader">Loading details...</div>'; }

    // Display error message
    function showError(message, container = pokemonListContainer) {
         console.error(`Showing error: "${message}" in container:`, container.id);
        if (container === pokemonListContainer) {
             if (container.children.length > 0 && !container.querySelector('.error-message')) {
                const errorP = document.createElement('p'); errorP.className = 'loader error-message'; errorP.style.color = 'red'; errorP.textContent = message; container.appendChild(errorP);
             } else if (container.children.length === 0) { container.innerHTML = `<p class="loader" style="color: red;">${message}</p>`; }
        } else if (container === modalContent) { container.innerHTML = `<p class="loader" style="color: red;">${message}</p>`; }
    }

    // Load a batch of Pokémon
    async function loadPokemon(clearExisting = false) {
        console.log(`loadPokemon called: isLoading=${isLoading}, isEndOfList=${isEndOfList}, offset=${currentOffset}, clear=${clearExisting}`);
        if (isLoading || isEndOfList) { console.log('loadPokemon returning early.'); return; }
        isLoading = true; showLoader(true);
        const url = `${POKEAPI_BASE_URL}pokemon?limit=${LOAD_LIMIT}&offset=${currentOffset}`;
        console.log(`Workspaceing Pokemon list from: ${url}`);
        const data = await fetchApiData(url);
        if (data && data.results) {
            console.log(`Workspaceed ${data.results.length} Pokémon.`);
            displayPokemonList(data.results, clearExisting);
            currentOffset += data.results.length;
            isEndOfList = !data.next;
            console.log(`Current offset: ${currentOffset}, Is end of list: ${isEndOfList}`);
             if (isEndOfList) { console.log("Reached the end of the Pokémon list."); loader.textContent = "No more Pokémon to load."; showLoader(true); }
        } else {
             console.error("Failed to fetch or process Pokémon list batch.");
             if (!isEndOfList) { showError("Could not load more Pokémon.", pokemonListContainer); isEndOfList = true; loader.textContent = "Error loading Pokémon."; showLoader(true); }
        }
        if (!isEndOfList) { showLoader(false); } // Hide only if not end/error
        isLoading = false; console.log(`loadPokemon finished: isLoading=${isLoading}, isEndOfList=${isEndOfList}`);
    }

     // Fetch all Pokémon names for searching
     async function fetchAllPokemonNames() {
        const MAX_POKEMON_COUNT = 1302; // Approx count including forms as of early 2025
        const url = `${POKEAPI_BASE_URL}pokemon?limit=${MAX_POKEMON_COUNT}&offset=0`;
        console.log("Fetching full Pokémon list for search...");
        const data = await fetchApiData(url);
        if (data && data.results) {
            allPokemonNameList = data.results;
            console.log(`Workspaceed ${allPokemonNameList.length} Pokémon names for search.`);
        } else {
            console.error("Failed to fetch the full Pokémon list for searching.");
            searchInput.placeholder = "Search unavailable"; searchInput.disabled = true;
        }
    }

    // Handle search input
    function handleSearch() {
        console.log('handleSearch triggered.');
        const searchTerm = searchInput.value.toLowerCase().trim();
        const existingError = pokemonListContainer.querySelector('.error-message');
        if (existingError) existingError.remove();
        pokemonListContainer.innerHTML = ''; isEndOfList = true; showLoader(false); // Disable infinite scroll during search

        if (!searchTerm) {
            console.log('Search cleared, resetting list.'); currentOffset = 0; isEndOfList = false;
            loadPokemon(true); return;
        }
        console.log(`Searching for: ${searchTerm}`);
        const filteredPokemon = allPokemonNameList.filter(pokemon => {
            const pokemonId = pokemon.url.match(/\/(\d+)\/?$/)?.[1];
            return pokemon.name.toLowerCase().includes(searchTerm) || pokemonId === searchTerm;
        });
        console.log(`Found ${filteredPokemon.length} search results.`);
        if (filteredPokemon.length > 0) { displayPokemonList(filteredPokemon, true); }
        else { pokemonListContainer.innerHTML = '<p class="loader">No Pokémon found matching your search.</p>'; }
    }

    // --- Event Listeners ---
    console.log('Adding scroll listener to:', pokemonListContainer);
    pokemonListContainer.addEventListener('scroll', () => {
        if (searchInput.value.trim() || isLoading || isEndOfList) { return; }
        const { scrollTop, scrollHeight, clientHeight } = pokemonListContainer;
        // console.log(`Scroll check: scrollTop=${scrollTop.toFixed(0)}, scrollHeight=${scrollHeight}, clientHeight=${clientHeight.toFixed(0)}, diff=${(scrollHeight - scrollTop - clientHeight).toFixed(0)}`);
        if (scrollHeight - scrollTop - clientHeight < clientHeight * 0.5 && !isLoading) { // Trigger if less than 50% of visible height remaining
            console.log("Near bottom detected, calling loadPokemon().");
            loadPokemon();
        }
    });

    searchInput.addEventListener('input', debounce(handleSearch, 400));

    closeModalButton.addEventListener('click', () => { modal.style.display = 'none'; modalContent.innerHTML = ''; });
    window.addEventListener('click', (event) => { if (event.target === modal) { modal.style.display = 'none'; modalContent.innerHTML = ''; } });

    // --- Initial Load ---
    async function initializePokedex() {
        console.log('Initializing Pokedex...');
        showLoader(true); pokemonListContainer.innerHTML = ''; // Clear list initially
        await fetchAllPokemonNames();
        await loadPokemon(); // Load the first batch
        console.log('Initialization complete.');
    }

    initializePokedex();
});
