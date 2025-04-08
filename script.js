document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const pokemonListContainer = document.getElementById('pokemonList');
    const searchInput = document.getElementById('searchInput');
    const loader = document.getElementById('loader');
    const modal = document.getElementById('pokemonDetailModal');
    const modalContent = document.getElementById('pokemonDetailContent');
    const closeModalButton = document.getElementById('closeModalButton');
    const yearSpan = document.getElementById('copyright-year');
    const noResultsMsg = document.getElementById('noResultsMessage');

    // --- Isotope Instance ---
    let iso; // Declare Isotope instance variable globally within this scope

    // --- Set current year ---
    if (yearSpan) {
        const currentYear = new Date().getFullYear();
        yearSpan.textContent = currentYear;
        console.log(`Copyright year set to: ${currentYear}`);
    } else {
        console.warn("Copyright year span not found.");
    }

    // --- API & State Variables ---
    const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2/';
    const POKEMON_SPRITE_URL_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
    const LOAD_LIMIT = 50;
    let currentOffset = 0;
    let isLoading = false;
    let allPokemonNameList = [];
    let detailCache = {};
    let searchTimeout;
    let isEndOfList = false;

    // --- Hardcoded TCG Set List ---
    const commonTcgSets = [ /* ... TCG list remains the same ... */ "SV: Scarlet & Violet 151", "Aquapolis", "Arceus", "Astral Radiance", "Base Set", "Base Set 2", "Battle Styles", "Black & White", "Boundaries Crossed", "BREAKpoint", "BREAKthrough", "Brilliant Stars", "Burning Shadows", "Call of Legends", "Celebrations", "Celestial Storm", "Champion's Path", "Chilling Reign", "Cosmic Eclipse", "Crimson Invasion", "Crown Zenith", "Crystal Guardians", "Dark Explorers", "Darkness Ablaze", "Deoxys", "Delta Species", "Detective Pikachu", "Diamond & Pearl", "Double Crisis", "Dragon", "Dragon Frontiers", "Dragon Majesty", "Dragon Vault", "Dragons Exalted", "Emerald", "Emerging Powers", "Evolving Skies", "Evolutions", "EX FireRed & LeafGreen", "EX Hidden Legends", "EX Holon Phantoms", "EX Legend Maker", "EX Power Keepers", "EX Ruby & Sapphire", "EX Sandstorm", "EX Team Magma vs Team Aqua", "EX Team Rocket Returns", "EX Unseen Forces", "Expedition Base Set", "Fates Collide", "Flashfire", "Forbidden Light", "Fossil", "Fusion Strike", "Furious Fists", "Generations", "Great Encounters", "Guardians Rising", "Gym Challenge", "Gym Heroes", "HeartGold & SoulSilver", "Hidden Fates", "Jungle", "Kalos Starter Set", "Legendary Collection", "Legendary Treasures", "Legends Awakened", "Lost Origin", "Lost Thunder", "Majestic Dawn", "McDonald's Collection 2011", "McDonald's Collection 2012", "McDonald's Collection 2013", "McDonald's Collection 2014", "McDonald's Collection 2015", "McDonald's Collection 2016", "McDonald's Collection 2017", "McDonald's Collection 2018", "McDonald's Collection 2019", "McDonald's Collection 2021", "McDonald's Collection 2022", "McDonald's Collection 2023", "McDonald's Collection 2024", "Mysterious Treasures", "Neo Destiny", "Neo Discovery", "Neo Genesis", "Neo Revelation", "Next Destinies", "Noble Victories", "Obsidian Flames", "Paldea Evolved", "Paldean Fates", "Paradox Rift", "Phantom Forces", "Plasma Blast", "Plasma Freeze", "Plasma Storm", "Platinum", "Pokemon GO", "POP Series 1", "POP Series 2", "POP Series 3", "POP Series 4", "POP Series 5", "POP Series 6", "POP Series 7", "POP Series 8", "POP Series 9", "Primal Clash", "Rebel Clash", "Rising Rivals", "Roaring Skies", "Scarlet & Violet", "Secret Wonders", "Shining Fates", "Shining Legends", "Silver Tempest", "Skyridge", "Steam Siege", "Stormfront", "Sun & Moon", "Supreme Victors", "Sword & Shield", "Team Rocket", "Team Up", "Temporal Forces", "Triumphant", "Twilight Masquerade", "Ultra Prism", "Unbroken Bonds", "Undaunted", "Unified Minds", "Unleashed", "Vivid Voltage", "XY" ].sort();

    console.log('Pokedex script loaded.');

    // --- Functions ---

    function debounce(func, delay) { return function(...args){ clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { func.apply(this, args); }, delay); }; }

    async function fetchApiData(url) { try { const response = await fetch(url); if (!response.ok) { if (response.status === 404) { console.warn(`Resource not found: ${url}`); return null; } throw new Error(`HTTP error! Status: ${response.status}`); } return await response.json(); } catch (error) { console.error("Error fetching data:", error); showError("Failed to connect to API. Check connection."); return null; } }

    async function getPokemonDetails(url) { if (detailCache[url]) { return detailCache[url]; } console.log(`Workspaceing details for: ${url}`); showModalLoader(); const data = await fetchApiData(url); if (data) { detailCache[url] = data; console.log(`Details fetched and cached for: ${url}`); } else { console.error(`Failed to fetch details from: ${url}`); } return data; }

    // Create HTML card element (returns DOM node, adds data attributes)
    function createPokemonCard(pokemon) {
        const card = document.createElement('div');
        card.classList.add('pokemon-card');
        card.dataset.url = pokemon.url;

        const pokemonIdMatch = pokemon.url.match(/\/(\d+)\/?$/);
        if (!pokemonIdMatch) { return null; }
        const pokemonId = pokemonIdMatch[1];
        const spriteUrl = `${POKEMON_SPRITE_URL_BASE}${pokemonId}.png`;

        card.dataset.name = pokemon.name; // For filtering
        card.dataset.id = pokemonId; // For filtering

        card.innerHTML = `
            <div class="pokemon-id">#${pokemonId.padStart(3, '0')}</div>
            <img src="${spriteUrl}" alt="${pokemon.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.pokemon-name').textContent += ' (img error)'; this.onerror=null;">
            <div class="pokemon-name">${pokemon.name}</div>
        `;

        card.addEventListener('click', async () => {
             console.log(`Card clicked: ${pokemon.name}, URL: ${pokemon.url}`);
             const detailUrl = card.dataset.url;
             modal.style.display = 'flex';
             showModalLoader();
             const detailedData = await getPokemonDetails(detailUrl);
             if (detailedData) {
                 displayPokemonDetails(detailedData);
             } else {
                 showError("Could not load details for this Pokémon.", modalContent);
             }
        });
        return card;
    }

    // Creates an array of DOM elements for new cards
    function createPokemonCardElements(pokemonArray) {
         if (!pokemonArray || pokemonArray.length === 0) return [];
         console.log(`Creating ${pokemonArray.length} Pokémon card elements.`);
         return pokemonArray.map(createPokemonCard).filter(card => card !== null); // Create and filter out nulls
     }

    // Display Pokémon details in modal (logic remains the same)
    function displayPokemonDetails(pokemon) { if (!pokemon) { showError("Pokémon details unavailable.", modalContent); return; } /* ... innerHTML generation ... */ /* ... TCG button logic ... */ console.log(`Displaying details for: ${pokemon.name}`); const pokemonId = pokemon.id; const pokemonName = pokemon.name; const encodedPokemonName = encodeURIComponent(pokemonName); const animatedSpriteUrl = pokemon.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default; const officialArtUrl = pokemon.sprites?.other?.['official-artwork']?.front_default; const defaultSpriteUrl = pokemon.sprites?.front_default; const backupSpriteUrl = `${POKEMON_SPRITE_URL_BASE}${pokemonId}.png`; const spriteUrl = animatedSpriteUrl || officialArtUrl || defaultSpriteUrl || backupSpriteUrl; const typesHtml = pokemon.types.map(typeInfo => `<span class="type-${typeInfo.type.name}">${typeInfo.type.name}</span>`).join(''); const maxStatValue = 255; const statsHtml = pokemon.stats.map(statInfo => { const statName = statInfo.stat.name.replace('special-', 'sp. '); const statValue = statInfo.base_stat; const statPercentage = Math.max(1, Math.min(100, (statValue / maxStatValue) * 100)); return `<p><strong>${statName}:</strong><span>${statValue}</span><div class="stat-bar-container"><div class="stat-bar" style="width: ${statPercentage}%; background-color: ${getStatColor(statValue)};"></div></div></p>`; }).join(''); const abilities = pokemon.abilities.map(a => a.ability.name.replace('-', ' ')).join(', '); const height = (pokemon.height / 10).toFixed(1); const weight = (pokemon.weight / 10).toFixed(1); const tcgSetSearchHtml = `<div class="tcg-set-search"><label for="tcgSetSelect">Check TCG Card Price:</label><div class="tcg-controls"><select id="tcgSetSelect"><option value="">-- Any Set --</option>${commonTcgSets.map(set => `<option value="${encodeURIComponent(set)}">${set}</option>`).join('')}</select><input type="text" id="tcgCardNumberInput" placeholder="Card #"><button id="tcgSearchButton">Search TCGplayer</button></div><p class="tcg-note"><i>Note: Set list includes common sets, may not be exhaustive.</i></p></div>`; const priceHtml = `<div class="price-info"><p><i>General Price Check Links:</i></p><a href="https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodedPokemonName}&view=grid" target="_blank" rel="noopener noreferrer">TCGplayer (All)</a> | <a href="https://www.pricecharting.com/search-products?q=pokemon+${encodedPokemonName}&type=prices" target="_blank" rel="noopener noreferrer">PriceCharting</a> | <a href="https://www.ebay.com/sch/i.html?_nkw=pokemon+${encodedPokemonName}+card" target="_blank" rel="noopener noreferrer">eBay</a></div>`; modalContent.innerHTML = `<h2>${pokemonName} (#${pokemonId.toString().padStart(3, '0')})</h2><img src="${spriteUrl}" alt="${pokemonName}" onerror="this.onerror=null; this.src='${backupSpriteUrl}';"><div class="pokemon-types">${typesHtml}</div><p>Height: ${height} m | Weight: ${weight} kg</p><p><strong>Abilities:</strong> ${abilities}</p><div class="pokemon-stats"><h3>Base Stats</h3>${statsHtml}</div>${tcgSetSearchHtml}${priceHtml}`; const tcgSearchButton = modalContent.querySelector('#tcgSearchButton'); const tcgSetSelect = modalContent.querySelector('#tcgSetSelect'); const tcgCardNumberInput = modalContent.querySelector('#tcgCardNumberInput'); if (tcgSearchButton && tcgSetSelect && tcgCardNumberInput) { tcgSearchButton.addEventListener('click', () => { const selectedEncodedSetName = tcgSetSelect.value; const cardNumber = tcgCardNumberInput.value.trim(); let searchQuery = encodedPokemonName; if (cardNumber) { searchQuery += `+${encodeURIComponent(cardNumber)}`; } let tcgUrl = `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${searchQuery}&view=grid&page=1`; if (selectedEncodedSetName) { tcgUrl += `&setName=${selectedEncodedSetName}`; } console.log(`Opening TCGplayer search: ${tcgUrl}`); window.open(tcgUrl, '_blank', 'noopener,noreferrer'); }); } else { console.error("Could not find TCG search button, select, or card number input element."); } }

    function getStatColor(value) { if (value < 60) return '#EF5350'; if (value < 90) return '#FFAC33'; if (value < 110) return '#FFEB3B'; if (value < 140) return '#7AC74C'; return '#2196F3'; }

    function showLoader(show = true) {
        if (!loader) return;
        // Remove specific text/end classes first
        loader.classList.remove('error-message', 'end-of-list-message');
        loader.textContent = ""; // Clear any text
        loader.style.border = ''; // Reset border for spinner
        loader.style.animation = ''; // Reset animation for spinner

        if (show) {
            loader.style.display = 'block';
        } else {
            loader.style.display = 'none';
        }
    }

    function showEndOfListMessage() {
        if (!loader) return;
        loader.style.display = 'block';
        loader.classList.add('end-of-list-message'); // Use class for styling
        loader.textContent = "No more Pokémon to load.";
        // CSS class .end-of-list-message handles visual style (no border/spin, visible text)
    }

    function showModalLoader() { modalContent.innerHTML = '<div class="loader"></div>'; }

    function showError(message, container = pokemonListContainer) {
        console.error(`Showing error: "${message}" in container:`, container.id || 'Unknown Container');
        const errorElementHTML = `<p class="loader error-message">${message}</p>`;
        if (container === pokemonListContainer) {
            // We don't want to clear Isotope items, display error differently
            // Option 1: Show error using the main loader element temporarily
            if(loader) {
                loader.classList.remove('end-of-list-message');
                loader.classList.add('error-message');
                loader.textContent = message;
                loader.style.display = 'block';
            }
            // Option 2: Show error in a dedicated header/footer area (requires HTML change)
            console.error("Error displayed in main list area (via loader element)");
            showLoader(true); // Ensure loader element is visible to show error class styles
            setTimeout(() => { // Optionally hide error after some time
               // if (loader.classList.contains('error-message')) showLoader(false);
            }, 5000);

        } else if (container === modalContent) {
            container.innerHTML = errorElementHTML; // Okay to replace modal content
        }
    }

    // Load a batch of Pokémon (integrates with Isotope)
    async function loadPokemon() {
        console.log(`loadPokemon called: isLoading=${isLoading}, isEndOfList=${isEndOfList}, offset=${currentOffset}`);
        if (isLoading || isEndOfList) {
             if (isEndOfList) showEndOfListMessage();
             else showLoader(false); // Hide if loading but not end
            return;
        }
        isLoading = true;
        showLoader(true);
        noResultsMsg.style.display = 'none';

        const url = `${POKEAPI_BASE_URL}pokemon?limit=${LOAD_LIMIT}&offset=${currentOffset}`;
        console.log(`Workspaceing Pokemon list from: ${url}`);
        const data = await fetchApiData(url);

        if (data && data.results) {
            const newCardElements = createPokemonCardElements(data.results);

            if (newCardElements.length > 0) {
                // 1. Append elements to the DOM first
                const fragment = document.createDocumentFragment();
                newCardElements.forEach(el => fragment.appendChild(el));
                pokemonListContainer.appendChild(fragment);
                console.log(`Appended ${newCardElements.length} card elements to DOM.`);

                // 2. Handle Isotope
                if (iso) {
                    // Isotope initialized, add new items
                    console.log("Adding items to existing Isotope instance...");
                    iso.appended(newCardElements); // Pass the array of NEW elements
                    // iso.layout(); // Might not be needed, appended often triggers layout
                    console.log('Isotope appended call complete.');
                } else {
                    // First load, initialize Isotope NOW that items are in the DOM
                    console.log('Initializing Isotope...');
                    try {
                        iso = new Isotope(pokemonListContainer, {
                            itemSelector: '.pokemon-card',
                            layoutMode: 'fitRows', // or 'masonry'
                            // transitionDuration: '0.4s', // Optional: Sync with CSS
                            fitRows: {
                                gutter: 10 // Match margin * 2 roughly, or adjust CSS margin only
                            }
                            // Optional: Add sorting if needed later
                            // getSortData: { name: '[data-name]' },
                            // sortBy: 'name'
                        });
                        console.log('Isotope initialized successfully.');
                        // Apply initial filter if search input has value on load
                        if (searchInput.value) {
                            handleSearch();
                        }
                    } catch (error) {
                        console.error("****** Error Initializing Isotope: ******", error);
                        showError("Failed to initialize layout animation.");
                        // Consider falling back to a non-isotope layout?
                    }
                }
            }

            currentOffset += data.results.length;
            isEndOfList = !data.next;
            console.log(`Current offset: ${currentOffset}, Is end of list: ${isEndOfList}`);

            if (isEndOfList) {
                showEndOfListMessage();
            } else {
                showLoader(false);
            }
        } else {
            console.error("Failed to fetch or process Pokémon list batch.");
            if (!iso || iso.items.length === 0) {
                // Show error only if list is empty, otherwise rely on console
                 showError("Could not load Pokémon list.");
            }
            showLoader(false);
        }

        isLoading = false;
    }

    // Fetch all Pokémon names for search data
    async function fetchAllPokemonNames() {
        const MAX_POKEMON_COUNT = 1302; // Adjust as needed
        const url = `${POKEAPI_BASE_URL}pokemon?limit=${MAX_POKEMON_COUNT}&offset=0`;
        console.log("Fetching full Pokémon list for search...");
        const data = await fetchApiData(url);
        if (data && data.results) {
            allPokemonNameList = data.results; // Store for filtering logic if needed
            console.log(`Workspaceed ${allPokemonNameList.length} Pokémon names for search.`);
            searchInput.disabled = false;
            searchInput.placeholder = "Search Pokémon by name or ID...";
        } else {
            console.error("Failed to fetch the full Pokémon list for searching.");
            showError("Could not load search data. Search disabled.");
            searchInput.placeholder = "Search unavailable";
            searchInput.disabled = true;
        }
    }

    // Handle search using Isotope filter
    function handleSearch() {
        if (!iso) {
            console.warn("Isotope not initialized yet, cannot filter.");
            // Optionally try again shortly if needed: setTimeout(handleSearch, 100);
            return;
        }
        console.log('handleSearch triggered for Isotope.');

        const searchTerm = searchInput.value.toLowerCase().trim();

        const checkResults = () => {
            // Use a timeout to allow Isotope layout/transitions to potentially finish
            setTimeout(() => {
                // Check if iso exists AND has filteredItems property
                const filteredCount = (iso && iso.filteredItems) ? iso.filteredItems.length : 0;
                console.log(`Filtered items count: ${filteredCount}`);
                 if (filteredCount === 0 && searchTerm !== '') {
                    noResultsMsg.style.display = 'block';
                 } else {
                    noResultsMsg.style.display = 'none';
                 }

                // Also handle the main loader visibility after search/filter
                 if (isEndOfList && !searchTerm) { // Show end message if search cleared and at end
                     showEndOfListMessage();
                 } else if (!isLoading) { // Hide loader if not loading
                     showLoader(false);
                 }

            }, 450); // Should roughly match or exceed CSS transition duration
        };

        if (!searchTerm) {
            iso.arrange({ filter: '*' }); // '*' is the selector for all items
            console.log('Isotope filter cleared.');
        } else {
            console.log(`Filtering Isotope for: ${searchTerm}`);
            // Define filter function directly
            const filterFunction = function(itemElement) {
                const name = itemElement.dataset.name ? itemElement.dataset.name.toLowerCase() : '';
                const id = itemElement.dataset.id || '';
                return name.includes(searchTerm) || id === searchTerm;
            };
            iso.arrange({ filter: filterFunction });
        }

        // Check results after applying filter/clearing
        checkResults();
        // Ensure loader isn't showing spinner during inactive search results
        if (!isLoading && !(isEndOfList && !searchTerm)) {
             showLoader(false);
        }
    }

    // --- Event Listeners ---
    pokemonListContainer.addEventListener('scroll', () => {
        if (searchInput.value.trim() || isLoading || isEndOfList) return;
        const { scrollTop, scrollHeight, clientHeight } = pokemonListContainer;
        if (scrollHeight > clientHeight && scrollHeight - scrollTop - clientHeight < clientHeight * 1.5) {
            loadPokemon();
        }
    });

    searchInput.addEventListener('input', debounce(handleSearch, 400));

    closeModalButton.addEventListener('click', () => { modal.style.display = 'none'; modalContent.innerHTML = ''; });

    window.addEventListener('click', (event) => { if (event.target === modal) { modal.style.display = 'none'; modalContent.innerHTML = ''; } });

    // --- Initial Load ---
    async function initializePokedex() {
        console.log('Initializing Pokedex...');
        showLoader(true);
        pokemonListContainer.innerHTML = ''; // Clear container
        noResultsMsg.style.display = 'none';
        iso = null; // Ensure Isotope instance is null initially

        await fetchAllPokemonNames();

        if (allPokemonNameList.length > 0) {
            // Load first batch - Isotope initializes *inside* loadPokemon now
            await loadPokemon();
        } else {
            console.log("Initialization halted: Failed to fetch name list.");
            showLoader(false);
            // Error message already shown by fetchAllPokemonNames
        }
        console.log('Initialization complete.');
    }

    // Start the application
    initializePokedex();

});
