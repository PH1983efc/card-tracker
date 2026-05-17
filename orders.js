let orders = [];
let selectedCardIds = [];
let cards = [];

async function loadCards() {
    const res = await fetch("cards.json");
    cards = await res.json();
}

function showPanel(id) {
    document.getElementById(id).style.display = "flex";
}

function hidePanel(id) {
    document.getElementById(id).style.display = "none";
}

/* ORDERS JS YOU PROVIDED */
<— paste your full Orders JS here exactly as-is —>