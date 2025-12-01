/* * =========================================
 * App
 * =========================================
 */

// --- Variables ---
let currentPairs = []; // Store raw data to use in modal selection

// --- Autocomplete Logic ---

function handleInput(value) {
    const suggestionsBox = document.getElementById('suggestions');
    if (!value) {
        suggestionsBox.style.display = 'none';
        return;
    }

    const lowerVal = value.toLowerCase();
    const filtered = TOKEN_DATA.filter(t => 
        t.name.toLowerCase().includes(lowerVal) || 
        t.symbol.toLowerCase().includes(lowerVal) || 
        t.address.toLowerCase().includes(lowerVal)
    ).slice(0, 5); // Limit to 5 results

    if (filtered.length > 0) {
        suggestionsBox.innerHTML = filtered.map(t => `
            <div class="suggestion-item" onclick="selectSuggestion('${t.address}')">
                <div>
                    <span class="font-bold text-white">${t.symbol}</span>
                    <span class="text-gray-400 text-xs ml-2">${t.name}</span>
                </div>
                <i class="fa-solid fa-arrow-right text-gray-500 text-xs"></i>
            </div>
        `).join('');
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
    }
}

function selectSuggestion(address) {
    const input = document.getElementById('tokenInput');
    input.value = address;
    closeSuggestions();
    fetchTokenData();
}

function closeSuggestions() {
    // Slight delay to allow click event to register before hiding
    setTimeout(() => {
        const box = document.getElementById('suggestions');
        if(box) box.style.display = 'none';
    }, 200);
}

function clearSearch() {
    const input = document.getElementById('tokenInput');
    input.value = '';
    input.focus();
    closeSuggestions();
}

function closeModal() {
    document.getElementById('tokenModal').classList.add('hidden');
}

// --- Core Logic ---

async function fetchTokenData() {
    const input = document.getElementById('tokenInput');
    const query = input.value.trim();
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    const welcomeState = document.getElementById('welcomeState');
    const errorState = document.getElementById('errorState');
    const dashboard = document.getElementById('dashboard');
    const errorMsg = document.getElementById('errorMsg');

    if (!query) return;

    // UI Loading State
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    errorState.classList.add('hidden');
    closeSuggestions();

    try {
        let apiUrl = "";
        
        // LOGIC: If it looks like an address (long string, no spaces), use tokens endpoint.
        // Otherwise, use search endpoint for symbols (SOL, WETH, Pikachu, etc.)
        const isAddress = query.length > 25 && !query.includes(" ");

        if (isAddress) {
            apiUrl = `https://api.dexscreener.com/latest/dex/tokens/${query}`;
        } else {
            // Use encodeURIComponent to handle special characters or spaces safely
            apiUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
        }

        console.log("Fetching URL:", apiUrl); 

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!data.pairs || data.pairs.length === 0) {
            throw new Error("No pairs found. Try searching by contract address.");
        }

        // Store pairs globally for sorting/selecting logic
        currentPairs = data.pairs;

        // --- SELECTION MODEL LOGIC ---
        
        // 1. Group pairs by unique Token Address
        // DexScreener returns multiple pairs for the SAME token (e.g. SOL/USDC, SOL/USDT).
        // We want to count how many DISTINCT tokens we found (e.g. PIKACHU on Sol, PIKACHU on Base).
        const uniqueTokens = {};

        currentPairs.forEach(pair => {
            const addr = pair.baseToken.address;
            
            // FIX: Check if liquidity object exists before accessing .usd
            // Some pairs returned by API have no liquidity data, causing the crash.
            const liq = (pair.liquidity && pair.liquidity.usd) ? pair.liquidity.usd : 0;

            // Initialize if new token
            if (!uniqueTokens[addr]) {
                uniqueTokens[addr] = {
                    baseToken: pair.baseToken,
                    quoteToken: pair.quoteToken,
                    chainId: pair.chainId,
                    maxLiquidity: 0,
                    pairs: [] // Store all pairs for this token
                };
            }

            // Update stats
            uniqueTokens[addr].pairs.push(pair);
            if (liq > uniqueTokens[addr].maxLiquidity) {
                uniqueTokens[addr].maxLiquidity = liq;
            }
        });

        // 2. Filter out "Dust" (tokens with < $100 liquidity) to avoid spam
        // But if it's a direct address search, keep everything.
        let validTokens = Object.values(uniqueTokens);
        
        if (!isAddress) {
            validTokens = validTokens.filter(t => t.maxLiquidity > 100);
        }

        // 3. Decision Time
        if (validTokens.length === 0) {
            throw new Error("No tokens found with sufficient liquidity.");
        } else if (validTokens.length === 1) {
            // Only one valid token found -> Load it immediately
            loadTokenByAddress(validTokens[0].baseToken.address);
        } else {
            // Multiple tokens found -> Show Selection Modal
            showSelectionModal(validTokens);
        }
        
    } catch (err) {
        console.error(err);
        welcomeState.classList.add('hidden');
        dashboard.classList.add('hidden');
        errorState.classList.remove('hidden');
        // Show the actual error message to help debug
        errorMsg.innerText = err.message || "Error fetching data.";
    } finally {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
}

// Show the modal populated with the distinct tokens found
function showSelectionModal(tokens) {
    const modal = document.getElementById('tokenModal');
    const list = document.getElementById('tokenList');
    
    // Sort tokens by highest liquidity first
    tokens.sort((a, b) => b.maxLiquidity - a.maxLiquidity);

    list.innerHTML = tokens.map(t => `
        <div class="bg-gray-700/50 hover:bg-gray-700 p-3 rounded-lg cursor-pointer flex items-center justify-between border border-gray-600 transition-colors"
             onclick="loadTokenByAddress('${t.baseToken.address}')">
            <div class="flex items-center gap-3">
                <div class="bg-gray-800 p-2 rounded-full w-10 h-10 flex items-center justify-center text-xs font-bold text-gray-500">
                    ${t.chainId.substring(0,2).toUpperCase()}
                </div>
                <div>
                    <div class="font-bold text-white flex items-center gap-2">
                        ${t.baseToken.symbol}
                        <span class="text-xs font-normal text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">${t.chainId}</span>
                    </div>
                    <div class="text-xs text-gray-400 truncate max-w-[150px]">${t.baseToken.name}</div>
                </div>
            </div>
            <div class="text-right">
                <div class="text-sm font-mono text-green-400">$${formatCompact(t.maxLiquidity)} Liq</div>
                <div class="text-xs text-gray-500">Address: ${t.baseToken.address.slice(0,4)}...${t.baseToken.address.slice(-4)}</div>
            </div>
        </div>
    `).join('');

    modal.classList.remove('hidden');
}

// Called when user clicks a token in modal OR when only 1 token is found
function loadTokenByAddress(address) {
    closeModal();
    
    // Find all pairs that belong to this specific address
    const pairsForThisToken = currentPairs.filter(p => p.baseToken.address === address);
    
    // Sort by liquidity to find the main pair
    // FIX: Added safety check for liquidity.usd here to prevent sorting crash
    const bestPair = pairsForThisToken.sort((a, b) => {
        const liqA = (a.liquidity && a.liquidity.usd) ? a.liquidity.usd : 0;
        const liqB = (b.liquidity && b.liquidity.usd) ? b.liquidity.usd : 0;
        return liqB - liqA;
    })[0];
    
    updateUI(bestPair);

    // Show dashboard
    document.getElementById('welcomeState').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('errorState').classList.add('hidden');
}

function updateUI(pair) {
    // Header Info
    document.getElementById('tokenName').innerText = pair.baseToken.name;
    document.getElementById('tokenSymbol').innerText = pair.baseToken.symbol;
    
    // Image Logic
    const imgUrl = pair.info && pair.info.imageUrl ? pair.info.imageUrl : 'https://cdn-icons-png.flaticon.com/512/12114/12114233.png';
    document.getElementById('tokenImage').src = imgUrl;

    // Price Formatting
    const price = parseFloat(pair.priceUsd);
    document.getElementById('tokenPrice').innerText = price < 0.01 ? `$${price.toFixed(8)}` : `$${price.toFixed(2)}`;
    
    // 24h Change
    const change = pair.priceChange.h24;
    const changeEl = document.getElementById('priceChange');
    changeEl.innerText = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
    changeEl.className = `text-sm font-medium mb-1 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`;

    // Liquidity & Volume
    // FIX: Check if liquidity exists
    const liqUsd = (pair.liquidity && pair.liquidity.usd) ? pair.liquidity.usd : 0;
    
    document.getElementById('tokenLiquidity').innerText = formatCurrency(liqUsd);
    document.getElementById('tokenFdv').innerText = formatCurrency(pair.fdv);
    document.getElementById('tokenVolume').innerText = formatCurrency(pair.volume.h24);
    document.getElementById('txCount').innerText = (pair.txns.h24.buys + pair.txns.h24.sells).toLocaleString();

    // Pair Info Sidebar
    document.getElementById('pairDex').innerText = pair.dexId.toUpperCase();
    document.getElementById('pairChain').innerText = pair.chainId;
    document.getElementById('pairAddress').innerText = pair.pairAddress;
    document.getElementById('baseToken').innerText = pair.baseToken.symbol;
    document.getElementById('quoteToken').innerText = pair.quoteToken.symbol;
    document.getElementById('dexLink').href = pair.url;

    // Price Changes List
    setColorAndText('change5m', pair.priceChange.m5);
    setColorAndText('change1h', pair.priceChange.h1);
    setColorAndText('change6h', pair.priceChange.h6);
    setColorAndText('change24h', pair.priceChange.h24);

    // Update Chart Iframe
    const chartUrl = `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;
    document.getElementById('chartFrame').src = chartUrl;
}

function setColorAndText(elementId, value) {
    const el = document.getElementById(elementId);
    if (value === undefined || value === null) {
        el.innerText = "-";
        el.className = "font-mono font-bold text-gray-500";
        return;
    }
    el.innerText = `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
    el.className = `font-mono font-bold ${value >= 0 ? 'text-green-400' : 'text-red-400'}`;
}

function formatCurrency(num) {
    if (!num) return "$0";
    if (num >= 1000000000) return "$" + (num / 1000000000).toFixed(2) + "B";
    if (num >= 1000000) return "$" + (num / 1000000).toFixed(2) + "M";
    if (num >= 1000) return "$" + (num / 1000).toFixed(2) + "K";
    return "$" + num.toFixed(2);
}

// Short format for Modal (e.g. 500k)
function formatCompact(num) {
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
}

function handleKeyPress(event) {
    if (event.key === 'Enter') fetchTokenData();
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert("Address copied to clipboard!");
}

// Close suggestions when clicking outside (handled by body onclick)
// Prevent closing when clicking inside the input or suggestions box
document.getElementById('tokenInput').addEventListener('click', (e) => e.stopPropagation());
