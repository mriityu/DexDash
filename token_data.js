/* * =========================================
 * Token Data & Export Helpers
 * =========================================
 */

const Utils = {
    // Format currency like $1.2B, $500K
    formatCurrency: (value) => {
        if (!value && value !== 0) return '-';
        if (value >= 1000000000) return '$' + (value / 1000000000).toFixed(2) + 'B';
        if (value >= 1000000) return '$' + (value / 1000000).toFixed(2) + 'M';
        if (value >= 1000) return '$' + (value / 1000).toFixed(2) + 'K';
        return '$' + value.toFixed(2);
    },

    // Format precision prices
    formatPrice: (price) => {
        if (!price) return '-';
        const num = parseFloat(price);
        if (num < 0.0001) return '$' + num.toFixed(8);
        if (num < 1) return '$' + num.toFixed(6);
        return '$' + num.toFixed(2);
    },

    // Calculate age
    formatAge: (timestamp) => {
        if (!timestamp) return 'Unknown';
        const created = new Date(timestamp);
        const now = new Date();
        const diffInHours = Math.abs(now - created) / 36e5;
        
        if (diffInHours < 1) return `${Math.floor(diffInHours * 60)} mins ago`;
        if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
        return `${Math.floor(diffInHours / 24)} days ago`;
    }
};

const Exporter = {
    // Generate and download JSON
    downloadJSON: (pair) => {
        const analysisData = {
            meta: {
                timestamp: new Date().toISOString(),
                platform: "DexDash",
                exported_by: "User"
            },
            identity: {
                name: pair.baseToken.name,
                symbol: pair.baseToken.symbol,
                address: pair.baseToken.address,
                chain: pair.chainId,
                dex: pair.dexId,
                pair_address: pair.pairAddress,
                url: pair.url
            },
            market_metrics: {
                price_usd: pair.priceUsd,
                price_native: pair.priceNative,
                liquidity_usd: pair.liquidity?.usd || 0,
                fdv: pair.fdv,
                market_cap: pair.marketCap
            },
            momentum: {
                change_1m: pair.priceChange.m1 || null,
                change_5m: pair.priceChange.m5 || null,
                change_15m: pair.priceChange.m15 || null,
                change_1h: pair.priceChange.h1 || null,
                change_6h: pair.priceChange.h6 || null,
                change_24h: pair.priceChange.h24 || null
            }
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(analysisData, null, 2));
        Exporter.triggerDownload(dataStr, `${pair.baseToken.symbol}_ANALYSIS.json`);
    },

    // Generate and download CSV
    downloadCSV: (pair) => {
        const headers = ["Metric", "Value", "Notes"];
        const rows = [
            ["Symbol", pair.baseToken.symbol, "Identity"],
            ["Name", pair.baseToken.name, "Identity"],
            ["Chain", pair.chainId, "Network"],
            ["Price USD", pair.priceUsd, "USD"],
            ["Liquidity", pair.liquidity?.usd || 0, "USD"],
            ["FDV", pair.fdv, "USD"],
            ["24h Volume", pair.volume.h24, "USD"],
            ["1m Change", (pair.priceChange.m1 || '-') + "%", "Percentage"],
            ["5m Change", (pair.priceChange.m5 || '-') + "%", "Percentage"],
            ["15m Change", (pair.priceChange.m15 || '-') + "%", "Percentage"],
            ["1h Change", (pair.priceChange.h1 || '-') + "%", "Percentage"],
            ["6h Change", (pair.priceChange.h6 || '-') + "%", "Percentage"],
            ["24h Change", (pair.priceChange.h24 || '-') + "%", "Percentage"],
            ["Buys (24h)", pair.txns.h24.buys, "Count"],
            ["Sells (24h)", pair.txns.h24.sells, "Count"],
            ["Pair Created", new Date(pair.pairCreatedAt).toLocaleDateString(), "Date"]
        ];

        let csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");

        Exporter.triggerDownload(encodeURI(csvContent), `${pair.baseToken.symbol}_DATA.csv`);
    },

    // Helper to create the link and click it
    triggerDownload: (href, filename) => {
        const link = document.createElement('a');
        link.setAttribute("href", href);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
};