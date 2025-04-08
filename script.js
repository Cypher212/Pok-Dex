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
        // Get the current date and year
        const currentYear = new Date().getFullYear();
        yearSpan.textContent = currentYear;
        console.log(`Copyright year set to: ${currentYear}`); // Log the year being set
    } else {
        console.warn("Copyright year span not found."); // Warn if the element is missing
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
    // NOTE: This list needs manual updating as new sets are released.
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
        "McDonald's Collection 2023", "McDonald's Collection 2024", // Example future McDonald's set
        "Mysterious Treasures", "Neo Destiny", "Neo Discovery", "Neo Genesis", "Neo Revelation",
        "Next Destinies", "Noble Victories", "Obsidian Flames", "Paldea Evolved", "Paldean Fates",
        "Paradox Rift", "Phantom Forces", "Plasma Blast", "Plasma Freeze", "Plasma Storm",
        "Platinum", "Pokemon GO", "POP Series 1", "POP Series 2", "POP Series 3", "POP Series 4",
        "POP Series 5", "POP Series 6", "POP Series 7", "POP Series 8", "POP Series 9",
        "Primal Clash", "Rebel Clash", "Rising Rivals", "Roaring Skies", "Scarlet & Violet",
        "Secret Wonders", "Shining Fates", "Shining Legends", "Silver Tempest", "Skyridge",
        "Steam Siege", "Stormfront", "Sun & Moon", "Supreme Victors", "Sword & Shield",
        "Team Rocket", "Team Up", "Temporal Forces", "Triumphant", "Twilight Masquerade", // Recent sets added
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
            showError("Failed to connect to API. Please check your connection and try again.", pokemonListContainer);
            return null;
        }
    }

    // Fetch details for a single Pokémon (with caching)
    async function getPokemonDetails(url) {
        if (detailCache[url]) { console.log(`Cache hit for: ${url}`); return detailCache[url]; }
        console.log(`Workspaceing details for: ${url}`);
        showModalLoader(); // Show loader *before* starting fetch
        const data = await fetchApiData(url);
        if (data) {
             detailCache[url] = data;
             console.log(`Details fetched and cached for: ${url}`);
         } else {
            console.error(`Failed to fetch details from: ${url}`);
            // Keep the modal loader showing the error (handled later)
         }
        return data;
    }

    // Create HTML for a Pokémon card
    function createPokemonCard(pokemon) {
        const card = document.createElement('div');
        card.classList.add('pokemon-card');
        card.dataset.url = pokemon.url; // Store the detail URL
        const pokemonIdMatch = pokemon.url.match(/\/(\d+)\/?$/);
        if (!pokemonIdMatch) { console.warn(`Could not extract ID from URL: ${pokemon.url}`); return null; } // Skip if ID can't be found
        const pokemonId = pokemonIdMatch[1];
        const spriteUrl = `${POKEMON_SPRITE_URL_BASE}${pokemonId}.png`;

        card.innerHTML = `
            <div class="pokemon-id">#${pokemonId.padStart(3, '0')}</div>
            <img src="${spriteUrl}" alt="${pokemon.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.pokemon-name').textContent += ' (img error)'; this.onerror=null;">
            <div class="pokemon-name">${pokemon.name}</div>
        `;

        // Add click listener to show details
        card.addEventListener('click', async () => {
            console.log(`Card clicked: ${pokemon.name}, URL: ${pokemon.url}`);
            const detailUrl = card.dataset.url; // Get URL from data attribute
            modal.style.display = 'flex'; // Show modal immediately
            showModalLoader(); // Show loading message in modal

            const detailedData = await getPokemonDetails(detailUrl); // Fetch or get from cache

            if (detailedData) {
                displayPokemonDetails(detailedData); // Display if successful
            } else {
                // Show error in modal if fetch failed
                showError("Could not load details for this Pokémon.", modalContent);
            }
        });
        return card;
    }

    // Append Pokémon cards to the list
    function displayPokemonList(pokemonArray, clearExisting = false) {
         if (clearExisting) { console.log('Clearing existing list for new display.'); pokemonListContainer.innerHTML = ''; }

         // Handle empty results after clearing or if array is empty
         if (!pokemonArray || pokemonArray.length === 0) {
             // Only show "No Pokémon found" if the container is truly empty (not just finished loading)
             if (pokemonListContainer.children.length === 0) {
                 console.log('No Pokémon to display, showing empty message.');
                 pokemonListContainer.innerHTML = '<p class="loader">No Pokémon found.</p>';
                 isEndOfList = true; // Treat no results as end of list for this context
                 showLoader(false); // Hide the main loader
             }
             return; // Stop processing
         }

         console.log(`Displaying ${pokemonArray.length} Pokémon cards.`);
         const fragment = document.createDocumentFragment(); // Use fragment for performance
         pokemonArray.forEach(pokemon => {
             // Simple check to avoid adding duplicates if the same list is somehow processed twice
             if (!clearExisting && pokemonListContainer.querySelector(`[data-url="${pokemon.url}"]`)) {
                 console.log(`Skipping duplicate: ${pokemon.name}`);
                 return;
             }
             const card = createPokemonCard(pokemon);
             if (card) { fragment.appendChild(card); }
         });
         pokemonListContainer.appendChild(fragment);

         // Remove potential "No Pokémon found" message if we just added cards
         const noPokemonMessage = pokemonListContainer.querySelector('p.loader');
         if (noPokemonMessage && noPokemonMessage.textContent.includes("No Pokémon found")) {
             noPokemonMessage.remove();
         }
    }

    // ============================================================
    // === UPDATED displayPokemonDetails Function Starts Here ===
    // ============================================================
    function displayPokemonDetails(pokemon) {
        if (!pokemon) {
            showError("Pokémon details unavailable.", modalContent);
            return;
        }
        console.log(`Displaying details for: ${pokemon.name}`);
        const pokemonId = pokemon.id;
        const pokemonName = pokemon.name; // Store for use in button listener
        const encodedPokemonName = encodeURIComponent(pokemonName);

        // Sprite selection logic
        const animatedSpriteUrl = pokemon.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default;
        const officialArtUrl = pokemon.sprites?.other?.['official-artwork']?.front_default;
        const defaultSpriteUrl = pokemon.sprites?.front_default;
        const backupSpriteUrl = `${POKEMON_SPRITE_URL_BASE}${pokemonId}.png`; // Static backup
        const spriteUrl = animatedSpriteUrl || officialArtUrl || defaultSpriteUrl || backupSpriteUrl; // Prioritize animated > official > default > backup

        // Types HTML
        const typesHtml = pokemon.types.map(typeInfo =>
            `<span class="type-${typeInfo.type.name}">${typeInfo.type.name}</span>`
        ).join('');

        // Stats HTML with percentage bars
        const maxStatValue = 255; // Generally accepted max base stat value for scaling
        const statsHtml = pokemon.stats.map(statInfo => {
            const statName = statInfo.stat.name.replace('special-', 'sp. '); // Abbreviate special stats
            const statValue = statInfo.base_stat;
            const statPercentage = Math.max(1, Math.min(100, (statValue / maxStatValue) * 100)); // Ensure > 0 for visibility
            return `
                <p>
                    <strong>${statName}:</strong>
                    <span>${statValue}</span>
                    <div class="stat-bar-container">
                        <div class="stat-bar" style="width: ${statPercentage}%; background-color: ${getStatColor(statValue)};"></div>
                    </div>
                </p>`;
        }).join('');

        // Abilities, Height, Weight
        const abilities = pokemon.abilities.map(a => a.ability.name.replace('-', ' ')).join(', ');
        const height = (pokemon.height / 10).toFixed(1); // Convert decimeters to meters
        const weight = (pokemon.weight / 10).toFixed(1); // Convert hectograms to kilograms

        // --- TCG Set Search UI (MODIFIED) ---
        const tcgSetSearchHtml = `
            <div class="tcg-set-search">
                <label for="tcgSetSelect">Check TCG Card Price:</label>
                <div class="tcg-controls">
                     <select id="tcgSetSelect">
                         <option value="">-- Any Set --</option> {/* Changed default text */}
                         ${commonTcgSets.map(set => `<option value="${encodeURIComponent(set)}">${set}</option>`).join('')}
                     </select>
                   
                     <input type="text" id="tcgCardNumberInput" placeholder="Card #">
                     <button id="tcgSearchButton">Search TCGplayer</button>
                </div>
                <p class="tcg-note"><i>Note: Set list includes common sets, may not be exhaustive.</i></p>
            </div>
        `;

        // --- Original Pricing Links ---
        const priceHtml = `
            <div class="price-info">
                <p><i>General Price Check Links:</i></p>
                <a href="https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodedPokemonName}&view=grid" target="_blank" rel="noopener noreferrer">TCGplayer (All)</a> |
                <a href="https://www.pricecharting.com/search-products?q=pokemon+${encodedPokemonName}&type=prices" target="_blank" rel="noopener noreferrer">PriceCharting</a> |
                <a href="https://www.ebay.com/sch/i.html?_nkw=pokemon+${encodedPokemonName}+card" target="_blank" rel="noopener noreferrer">eBay</a>
            </div>`;

        // --- Combine and Set Modal Content ---
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

        // --- Add Event Listener for the TCG Search Button (MODIFIED) ---
        const tcgSearchButton = modalContent.querySelector('#tcgSearchButton');
        const tcgSetSelect = modalContent.querySelector('#tcgSetSelect');
        const tcgCardNumberInput = modalContent.querySelector('#tcgCardNumberInput'); // Get the new input field

        // Check if all elements exist before adding listener
        if (tcgSearchButton && tcgSetSelect && tcgCardNumberInput) {
            tcgSearchButton.addEventListener('click', () => {
                const selectedEncodedSetName = tcgSetSelect.value; // Value is already encoded from the option value
                const cardNumber = tcgCardNumberInput.value.trim();

                // Build the base search query (q= parameter)
                // Start with the Pokémon name (already URI encoded)
                let searchQuery = encodedPokemonName;

                // If a card number is provided, add it to the search query
                // Encode the number itself in case it has special characters (e.g., promo numbers like SWSH050)
                if (cardNumber) {
                    // Use '+' or %20 for space. TCGplayer seems flexible, let's use '+'
                    searchQuery += `+${encodeURIComponent(cardNumber)}`;
                }

                // Construct the base URL with the search query
                let tcgUrl = `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${searchQuery}&view=grid&page=1`;

                // If a specific set was selected (value is not ""), add the setName parameter
                if (selectedEncodedSetName) {
                    tcgUrl += `&setName=${selectedEncodedSetName}`;
                }
                // If no set is selected, the URL will search across all sets by default

                console.log(`Opening TCGplayer search: ${tcgUrl}`);
                window.open(tcgUrl, '_blank', 'noopener,noreferrer');
            });
        } else {
            console.error("Could not find TCG search button, select, or card number input element.");
        }
    }
    // ============================================================
    // === UPDATED displayPokemonDetails Function Ends Here ===
    // ============================================================


    // Helper for stat bar color based on value
    function getStatColor(value) {
        if (value < 60) return '#EF5350'; // Red
        if (value < 90) return '#FFAC33'; // Orange
        if (value < 110) return '#FFEB3B'; // Yellow
        if (value < 140) return '#7AC74C'; // Green
        return '#2196F3';                 // Blue
    }

    // Show/Hide main loader
    function showLoader(show = true) {
        if (show) {
            loader.textContent = "Loading more Pokémon..."; // Reset text
            loader.style.display = 'block';
        } else {
            loader.style.display = 'none';
        }
    }
    // Show loader specifically inside the modal
    function showModalLoader() {
        modalContent.innerHTML = '<div class="loader">Loading details...</div>';
    }

    // Display error message in specified container
    function showError(message, container = pokemonListContainer) {
         console.error(`Showing error: "${message}" in container:`, container.id || 'Unknown Container');
         const errorElement = `<p class="loader error-message" style="color: red;">${message}</p>`;

         if (container === pokemonListContainer) {
             // Avoid adding multiple error messages to the main list
             const existingError = container.querySelector('.error-message');
             if (existingError) {
                 existingError.textContent = message; // Update existing message
             } else {
                 // If list has content, append error. If list is empty, replace content.
                 if (container.children.length > 0 && !container.textContent.includes("No Pokémon found")) {
                    const errorP = document.createElement('p');
                    errorP.className = 'loader error-message';
                    errorP.style.color = 'red';
                    errorP.textContent = message;
                    container.appendChild(errorP);
                 } else {
                     container.innerHTML = errorElement;
                 }
             }
             showLoader(false); // Hide the main loader if an error occurs in the list view
         } else if (container === modalContent) {
             // Always replace modal content with the error
             container.innerHTML = errorElement;
         }
     }


    // Load a batch of Pokémon (for infinite scroll)
    async function loadPokemon(clearExisting = false) {
        console.log(`loadPokemon called: isLoading=${isLoading}, isEndOfList=${isEndOfList}, offset=${currentOffset}, clear=${clearExisting}`);
        if (isLoading || isEndOfList) {
            console.log(`loadPokemon returning early: isLoading=${isLoading}, isEndOfList=${isEndOfList}`);
            // If it's the end of the list, ensure the message is shown
            if (isEndOfList && loader.textContent !== "No more Pokémon to load.") {
                 loader.textContent = "No more Pokémon to load.";
                 showLoader(true); // Keep showing the "end" message
             }
            return;
        }
        isLoading = true;
        showLoader(true); // Show loader before fetching

        const url = `${POKEAPI_BASE_URL}pokemon?limit=${LOAD_LIMIT}&offset=${currentOffset}`;
        console.log(`Workspaceing Pokemon list from: ${url}`);
        const data = await fetchApiData(url);

        if (data && data.results) {
            console.log(`Workspaceed ${data.results.length} Pokémon.`);
            displayPokemonList(data.results, clearExisting); // Display this batch
            currentOffset += data.results.length;       // Increment offset
            isEndOfList = !data.next;                    // Check if there's a next page
            console.log(`Current offset: ${currentOffset}, Is end of list: ${isEndOfList}`);

            if (isEndOfList) {
                console.log("Reached the end of the Pokémon list.");
                loader.textContent = "No more Pokémon to load.";
                showLoader(true); // Keep showing the "end" message loader element
            } else {
                 showLoader(false); // Hide loader if more can be loaded
             }
        } else {
             console.error("Failed to fetch or process Pokémon list batch.");
             // Avoid setting isEndOfList here unless API consistently fails
             // Show error message *without* replacing existing cards if possible
             showError("Could not load more Pokémon.", pokemonListContainer);
             // Optionally stop further loading attempts after an error:
             // isEndOfList = true;
             // loader.textContent = "Error loading Pokémon.";
             // showLoader(true);
             showLoader(false); // Hide loader after error shown by showError
        }

        isLoading = false; // Allow next fetch
        console.log(`loadPokemon finished: isLoading=${isLoading}, isEndOfList=${isEndOfList}`);
    }

    // Fetch all Pokémon names for searching (run once on init)
     async function fetchAllPokemonNames() {
         // Adjust count as needed based on PokeAPI total
         const MAX_POKEMON_COUNT = 1302; // As of Gen 9 + forms (approx)
         const url = `${POKEAPI_BASE_URL}pokemon?limit=${MAX_POKEMON_COUNT}&offset=0`;
         console.log("Fetching full Pokémon list for search...");
         const data = await fetchApiData(url);
         if (data && data.results) {
             allPokemonNameList = data.results;
             console.log(`Workspaceed ${allPokemonNameList.length} Pokémon names for search.`);
             searchInput.disabled = false; // Enable search input
             searchInput.placeholder = "Search Pokémon by name or ID...";
         } else {
             console.error("Failed to fetch the full Pokémon list for searching.");
             showError("Could not load Pokémon list for search.", pokemonListContainer);
             searchInput.placeholder = "Search unavailable";
             searchInput.disabled = true; // Disable if list fails
         }
     }

    // Handle search input changes (debounced)
    function handleSearch() {
        console.log('handleSearch triggered.');
        const searchTerm = searchInput.value.toLowerCase().trim();

        // Clear any previous error messages specific to search
        const existingError = pokemonListContainer.querySelector('.error-message');
        if (existingError) existingError.remove();

        // If search term is empty, reset to full list view
        if (!searchTerm) {
            console.log('Search cleared, resetting list.');
            isEndOfList = false; // Re-enable infinite scroll
            currentOffset = 0;   // Reset offset
            loadPokemon(true); // Load first page, clearing search results
            return;
        }

        // If search term exists, filter the pre-loaded list
        console.log(`Searching for: ${searchTerm}`);
        showLoader(false); // Hide "Loading more" during search
        isEndOfList = true; // Disable infinite scroll during search display

        const filteredPokemon = allPokemonNameList.filter(pokemon => {
            const pokemonId = pokemon.url.match(/\/(\d+)\/?$/)?.[1];
            // Check if name includes term OR if ID exactly matches term
            return pokemon.name.toLowerCase().includes(searchTerm) || pokemonId === searchTerm;
        });

        console.log(`Found ${filteredPokemon.length} search results.`);
        displayPokemonList(filteredPokemon, true); // Display results, clearing previous list/message

        // displayPokemonList handles the "No Pokémon found" message if filteredPokemon is empty
    }


    // --- Event Listeners ---

    // Infinite Scroll Listener on the list container
    console.log('Adding scroll listener to:', pokemonListContainer);
    pokemonListContainer.addEventListener('scroll', () => {
        // Prevent loading more if searching, already loading, or at the end
        if (searchInput.value.trim() || isLoading || isEndOfList) { return; }

        const { scrollTop, scrollHeight, clientHeight } = pokemonListContainer;
        // Trigger load if user is near the bottom (e.g., less than 1.5 * clientHeight from the end)
        if (scrollHeight - scrollTop - clientHeight < clientHeight * 1.5) {
            console.log("Near bottom detected, calling loadPokemon().");
            loadPokemon(); // Load next batch
        }
    });

    // Debounced Search Input Listener
    searchInput.addEventListener('input', debounce(handleSearch, 400)); // 400ms delay

    // Modal Close Button Listener
    closeModalButton.addEventListener('click', () => {
        modal.style.display = 'none';
        modalContent.innerHTML = ''; // Clear content on close
    });

    // Close modal if clicked outside the content area
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
            modalContent.innerHTML = ''; // Clear content on close
        }
    });

    // --- Initial Load ---
    async function initializePokedex() {
        console.log('Initializing Pokedex...');
        showLoader(true); // Show loader initially
        pokemonListContainer.innerHTML = ''; // Ensure list is clear on start
        await fetchAllPokemonNames(); // Get the full list for searching first
        // Only proceed to load the first batch if the name list fetch was successful
        if (allPokemonNameList.length > 0) {
             await loadPokemon(); // Load the first batch of cards
        } else {
             console.log("Initialization halted due to failure fetching name list.");
             // showError already called within fetchAllPokemonNames if it failed
             showLoader(false); // Hide loader if init fails here
        }
        console.log('Initialization complete.');
    }

    // Start the application
    initializePokedex();

});
