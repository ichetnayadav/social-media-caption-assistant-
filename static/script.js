const totalGenerationsElement = document.getElementById("totalGenerations");
const captionsCreatedElement = document.getElementById("captionsCreated");
const savedFavoritesElement = document.getElementById("savedFavorites");
const historyAvailableElement = document.getElementById("historyAvailable");

const captionForm = document.getElementById("captionForm");
const generateBtn = document.getElementById("generateBtn");
const statusBox = document.getElementById("resultsStatus") || document.getElementById("status");
const resultsList = document.getElementById("resultsList");
const resultsFooter = document.getElementById("resultsFooter");
const copyAllBtn = document.getElementById("copyAllBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");

const topicInput = document.getElementById("topic");
const topicCount = document.getElementById("topicCount");

const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const favoritesList = document.getElementById("favoritesList");
const clearFavoritesBtn = document.getElementById("clearFavoritesBtn");

const FAVORITES_KEY = "captionCraftFavorites";

const HISTORY_KEY = "captionCraftHistory";
const MAX_HISTORY = 10;

let latestCaptions = [];
let currentResultEntry = null;

// -----------------------------
// BASIC HELPERS
// -----------------------------

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined && text !== null) {
        element.textContent = text;
    }

    return element;
}

function getCaptionText(caption) {
    if (typeof caption === "string") {
        return caption;
    }

    return caption?.caption || caption?.text || "";
}

function getFullCaptionText(caption) {
    const text = getCaptionText(caption);

    if (typeof caption === "string" || !Array.isArray(caption?.hashtags)) {
        return text;
    }

    const hashtags = caption.hashtags
        .map(tag => String(tag).startsWith("#") ? tag : `#${tag}`)
        .join(" ");

    return hashtags ? `${text}\n\n${hashtags}` : text;
}

function showMessage(message, isError = false) {
    if (!statusBox) return;
    statusBox.textContent = message;
    const statusClass = statusBox.id === "status" ? "form-status" : "status-panel";
    statusBox.className = isError ? `${statusClass} error` : statusClass;
    statusBox.hidden = false;
}

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch (error) {
        console.error("Could not read history:", error);
        return [];
    }
}

function saveHistory(history) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
        console.error("Could not save history:", error);
        showMessage("Your captions were generated, but browser storage is unavailable.", true);
    }
}

// -----------------------------
// COPY FUNCTIONALITY
// -----------------------------

async function copyText(text, button) {
    try {
        await navigator.clipboard.writeText(text);

        if (button) {
            const oldText = button.textContent;
            button.textContent = "Copied!";
            setTimeout(() => {
                button.textContent = oldText;
            }, 1500);
        }
    } catch (error) {
        showMessage("Copy failed. Please select and copy the text manually.", true);
    }
}

// -----------------------------
// CAPTION CARDS
// -----------------------------


function createCaptionCard(caption, index) {
    const card = createElement("article", "caption-card");

    const heading = createElement("div", "caption-card-heading");

    heading.appendChild(
        createElement("span", "caption-number", `OPTION ${index + 1}`)
    );

    const favoriteButton = createElement("button", "favorite-btn", "☆");
    favoriteButton.type = "button";
    favoriteButton.title = "Add to favorites";
    favoriteButton.setAttribute("aria-label", "Add caption to favorites");

    const isFavorite = getFavorites().some(
        item => item.text === getFullCaptionText(caption)
    );

    favoriteButton.textContent = isFavorite ? "★" : "☆";
    favoriteButton.classList.toggle("is-favorite", isFavorite);

    favoriteButton.addEventListener("click", () => {
        toggleFavorite(caption, favoriteButton, index);
    });

    const copyButton = createElement("button", "copy-btn", "Copy");
    copyButton.type = "button";

    copyButton.addEventListener("click", () => {
        copyText(getFullCaptionText(caption), copyButton);
    });

    const editButton = createElement("button", "edit-btn", "Edit");
    editButton.type = "button";

    heading.appendChild(favoriteButton);
    heading.appendChild(editButton);
    heading.appendChild(copyButton);

    card.appendChild(heading);

    const captionText = createElement(
        "p",
        "caption-text",
        getCaptionText(caption)
    );

    card.appendChild(captionText);

    let hashtags = [];

    if (caption && typeof caption === "object" && Array.isArray(caption.hashtags)) {
        hashtags = [...caption.hashtags];
    }

    const hashtagList = createElement("div", "hashtag-list");

    function updateHashtags() {
        hashtagList.textContent = hashtags
            .map(tag => String(tag).startsWith("#") ? tag : `#${tag}`)
            .join(" ");
    }

    if (hashtags.length > 0) {
        updateHashtags();
        card.appendChild(hashtagList);
    }

    const editArea = createElement("div", "edit-area");
    editArea.hidden = true;

    const captionEditor = document.createElement("textarea");
    captionEditor.className = "caption-editor";
    captionEditor.value = getCaptionText(caption);
    captionEditor.placeholder = "Edit your caption here...";

    const hashtagEditor = document.createElement("input");
    hashtagEditor.className = "hashtag-editor";
    hashtagEditor.value = hashtags.map(tag =>
        String(tag).startsWith("#") ? tag : `#${tag}`
    ).join(" ");
    hashtagEditor.placeholder = "#hashtag1 #hashtag2";

    const saveButton = createElement("button", "save-edit-btn", "Save Changes");
    saveButton.type = "button";

    const cancelButton = createElement("button", "cancel-edit-btn", "Cancel");
    cancelButton.type = "button";

    editArea.appendChild(createElement("label", "", "Edit caption"));
    editArea.appendChild(captionEditor);
    editArea.appendChild(createElement("label", "", "Edit hashtags"));
    editArea.appendChild(hashtagEditor);

    const editActions = createElement("div", "edit-actions");
    editActions.appendChild(saveButton);
    editActions.appendChild(cancelButton);
    editArea.appendChild(editActions);

    card.appendChild(editArea);

    editButton.addEventListener("click", () => {
        captionEditor.value = captionText.textContent;

        hashtagEditor.value = hashtags.map(tag =>
            String(tag).startsWith("#") ? tag : `#${tag}`
        ).join(" ");

        editArea.hidden = false;
        editButton.hidden = true;
    });

    cancelButton.addEventListener("click", () => {
        editArea.hidden = true;
        editButton.hidden = false;
    });

    saveButton.addEventListener("click", () => {
        const updatedCaption = captionEditor.value.trim();

        if (!updatedCaption) {
            alert("Caption cannot be empty.");
            return;
        }

        hashtags = hashtagEditor.value
            .split(/[\s,]+/)
            .map(tag => tag.trim())
            .filter(Boolean)
            .map(tag => tag.startsWith("#") ? tag : `#${tag}`);

        captionText.textContent = updatedCaption;
        updateHashtags();

        if (hashtags.length === 0 && hashtagList.parentElement) {
            hashtagList.remove();
        } else if (hashtags.length > 0 && !hashtagList.parentElement) {
            card.insertBefore(editArea, editArea);
            card.insertBefore(hashtagList, editArea);
        }

        // Update the caption object so copying and favorites use edited content.
        if (typeof caption === "object" && caption !== null) {
            caption.caption = updatedCaption;
            caption.text = updatedCaption;
            caption.hashtags = hashtags;
        }

        editArea.hidden = true;
        editButton.hidden = false;

        refreshFavoriteButtons();
    });

    if (caption && typeof caption === "object") {
        const assessmentText =
            caption.assessment ||
            caption.verdict ||
            caption.score ||
            "";

        if (assessmentText) {
            card.appendChild(
                createElement("p", "assessment", String(assessmentText))
            );
        }

        if (caption.suggestion) {
            card.appendChild(
                createElement("p", "assessment", `Suggestion: ${caption.suggestion}`)
            );
        }
    }

    return card;
}


function displayCaptions(captions, overallNote = "", topic = "") {
    latestCaptions = captions || [];

    const viewingTopic = document.getElementById("viewingTopic");
    if (!viewingTopic || !resultsList) return;
    viewingTopic.replaceChildren();

    const titleLabel = createElement(
        "span",
        "viewing-topic-label",
        "CAPTIONS GENERATED FOR"
    );

    const titleText = createElement(
        "h3",
        "viewing-topic-title",
        topic || "Your captions"
    );

    viewingTopic.appendChild(titleLabel);
    viewingTopic.appendChild(titleText);
    viewingTopic.hidden = false;

    resultsList.replaceChildren();

    latestCaptions.forEach((caption, index) => {
        resultsList.appendChild(createCaptionCard(caption, index));
    });

    if (overallNote) {
        resultsList.appendChild(
            createElement("p", "overall-note", overallNote)
        );
    }

    resultsFooter.hidden = latestCaptions.length === 0;
    resultsList.hidden = latestCaptions.length === 0;
    statusBox.hidden = true;
}

// -----------------------------
// GENERATION HISTORY
// -----------------------------

function addToHistory(formData, responseData) {
    const history = getHistory();

    const newEntry = {
        id: Date.now().toString(),
        topic: formData.topic,
        platform: formData.platform,
        tone: formData.tone,
        audience: formData.audience,
        goal: formData.goal,
        language: formData.language,
        captions: responseData.captions,
        overallNote: responseData.overall_note || "",
        createdAt: new Date().toISOString()
    };

    history.unshift(newEntry);

    // Keep only the latest 10 generations.
    saveHistory(history.slice(0, MAX_HISTORY));

    renderHistory();
    updateDashboardStats();
    return newEntry;
}

function renderHistory() {
    if (!historyList) return;
    const history = getHistory();

    historyList.replaceChildren();

    if (history.length === 0) {
        const empty = createElement("div", "history-empty");
        empty.appendChild(createElement("span", "", "◷"));
        empty.appendChild(
            createElement("p", "", "Your generated captions will appear here.")
        );
        historyList.appendChild(empty);
        return;
    }

    history.forEach(entry => {
        const item = createElement("article", "history-item");
        const info = createElement("div", "history-info");

        info.appendChild(
            createElement("span", "history-topic", entry.topic || "Untitled topic")
        );

        const date = new Date(entry.createdAt);
        const dateText = Number.isNaN(date.getTime())
            ? "Previously generated"
            : date.toLocaleString();

        info.appendChild(
            createElement(
                "span",
                "history-meta",
                `${entry.platform || "Platform"} · ${entry.tone || "Friendly"} tone · ${dateText}`
            )
        );
        info.appendChild(
            createElement(
                "span",
                "history-caption-count",
                `${Array.isArray(entry.captions) ? entry.captions.length : 0} caption options`
            )
        );

        const actions = createElement("div", "history-actions");

        const viewButton = createElement("button", "history-view-btn", "View captions");
        viewButton.type = "button";

        viewButton.addEventListener("click", () => {
            window.location.assign(`/results?id=${encodeURIComponent(entry.id)}`);
        });

        const deleteButton = createElement("button", "history-delete-btn", "Delete");
        deleteButton.type = "button";

        deleteButton.addEventListener("click", () => {
            const updatedHistory = getHistory().filter(
                savedEntry => savedEntry.id !== entry.id
            );

            saveHistory(updatedHistory);
            renderHistory();
        });

        actions.appendChild(viewButton);
        actions.appendChild(deleteButton);

        item.appendChild(info);
        item.appendChild(actions);

        historyList.appendChild(item);
    });
}

// Clear all history.
if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", () => {
    const history = getHistory();

    if (history.length === 0) {
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to clear all generation history?"
    );

    if (confirmed) {
        saveHistory([]);
        renderHistory();
    }
});

// -----------------------------
// GENERATE CAPTIONS
// -----------------------------

if (captionForm) captionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = {
        topic: document.getElementById("topic").value.trim(),
        platform: document.getElementById("platform").value,
        tone: document.getElementById("tone").value,
        audience: document.getElementById("audience").value,
        goal: document.getElementById("goal").value,
        language: document.getElementById("language").value
    };

    if (!formData.topic) {
        showMessage("Please enter a topic first.", true);
        return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";
    showMessage("Creating your captions. Please wait...");

    try {
        const response = await fetch("/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong.");
        }

        if (!Array.isArray(data.captions) || data.captions.length === 0) {
            throw new Error("No captions were returned. Please try again.");
        }

        const savedEntry = addToHistory(formData, data);

        localStorage.setItem(
    TOTAL_GENERATIONS_KEY,
    getSavedNumber(TOTAL_GENERATIONS_KEY) + 1
);

localStorage.setItem(
    TOTAL_CAPTIONS_KEY,
    getSavedNumber(TOTAL_CAPTIONS_KEY) + data.captions.length
);

updateDashboardStats();
        window.location.assign(`/results?id=${encodeURIComponent(savedEntry.id)}`);

    } catch (error) {
        console.error("Generation error:", error);
        showMessage(error.message || "Unable to generate captions. Please try again.", true);
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate Captions";
    }
});

// -----------------------------
// COPY ALL CAPTIONS
// -----------------------------

if (copyAllBtn) copyAllBtn.addEventListener("click", () => {
    const allCaptions = latestCaptions
        .map((caption, index) => {
            return `Option ${index + 1}:\n${getFullCaptionText(caption)}`;
        })
        .join("\n\n--------------------\n\n");

    if (allCaptions) {
        copyText(allCaptions, copyAllBtn);
    }
});

// -----------------------------
// TOPIC CHARACTER COUNTER
// -----------------------------

if (topicInput) topicInput.addEventListener("input", () => {
    topicCount.textContent = topicInput.value.length;
});

// Load saved history when the page opens.
renderHistory();

// -----------------------------
// FAVORITES FUNCTIONALITY
// -----------------------------

function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
    } catch (error) {
        console.error("Could not read favorites:", error);
        return [];
    }
}

function saveFavorites(favorites) {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
        console.error("Could not save favorites:", error);
    }
}

function toggleFavorite(caption, button, captionIndex) {
    const favorites = getFavorites();
    const fullText = getFullCaptionText(caption);

    const existingIndex = favorites.findIndex(
        item => item.text === fullText
    );

    if (existingIndex !== -1) {
        favorites.splice(existingIndex, 1);
        button.textContent = "☆";
        button.classList.remove("is-favorite");
        button.title = "Add to favorites";
    } else {
        favorites.unshift({
            id: Date.now().toString(),
            text: fullText,
            topic: currentResultEntry?.topic || "",
            platform: currentResultEntry?.platform || "",
            historyId: currentResultEntry?.id || "",
            captionIndex,
            createdAt: new Date().toISOString()
        });

        button.textContent = "★";
        button.classList.add("is-favorite");
        button.title = "Remove from favorites";
    }
    button.setAttribute(
        "aria-label",
        existingIndex !== -1 ? "Add caption to favorites" : "Remove caption from favorites"
    );

    saveFavorites(favorites);
    renderFavorites();
    updateDashboardStats();
}

function renderFavorites() {
    if (!favoritesList) return;
    const favorites = getFavorites();

    favoritesList.replaceChildren();

    if (favorites.length === 0) {
        const empty = createElement("div", "history-empty");
        empty.appendChild(createElement("span", "", "☆"));
        empty.appendChild(
            createElement("p", "", "Your favorite captions will appear here.")
        );

        favoritesList.appendChild(empty);
        return;
    }

    favorites.forEach(item => {
        const card = createElement("div", "favorite-item");
        const source = getFavoriteSource(item);
        const sourceInfo = createElement("div", "favorite-source");
        sourceInfo.appendChild(createElement("span", "favorite-source-label", "FROM TOPIC"));
        sourceInfo.appendChild(createElement("h3", "favorite-source-topic", source.topic));
        if (source.platform) {
            sourceInfo.appendChild(
                createElement("span", "favorite-source-platform", source.platform)
            );
        }

        const captionText = createElement(
            "p",
            "favorite-caption-text",
            item.text
        );

        const actions = createElement("div", "history-actions");

        const copyButton = createElement(
            "button",
            "history-view-btn",
            "Copy"
        );

        copyButton.type = "button";
        copyButton.addEventListener("click", () => {
            copyText(item.text, copyButton);
        });

        const removeButton = createElement(
            "button",
            "history-delete-btn",
            "Remove"
        );

        removeButton.type = "button";
        removeButton.addEventListener("click", () => {
            const updated = getFavorites().filter(
                favorite => favorite.id !== item.id
            );

            saveFavorites(updated);
            renderFavorites();
            refreshFavoriteButtons();
            updateDashboardStats();
        });

        actions.appendChild(copyButton);
        actions.appendChild(removeButton);

        card.appendChild(sourceInfo);
        card.appendChild(captionText);
        card.appendChild(actions);

        favoritesList.appendChild(card);
    });
}

function getFavoriteSource(favorite) {
    if (favorite.topic) {
        return { topic: favorite.topic, platform: favorite.platform || "" };
    }

    const historyEntry = getHistory().find(entry => {
        if (favorite.historyId && entry.id === favorite.historyId) return true;
        return Array.isArray(entry.captions)
            && entry.captions.some(caption => getFullCaptionText(caption) === favorite.text);
    });

    if (historyEntry) {
        return {
            topic: historyEntry.topic || "",
            platform: historyEntry.platform || ""
        };
    }

    return { topic: "Topic no longer in history", platform: "" };
}

function refreshFavoriteButtons() {
    const favorites = getFavorites();

    document.querySelectorAll(".caption-card").forEach(card => {
        const captionText = card.querySelector(".caption-text");

        if (!captionText) return;

        const hashtags = card.querySelector(".hashtag-list");

        const fullText = hashtags
            ? `${captionText.textContent}\n\n${hashtags.textContent}`
            : captionText.textContent;

        const button = card.querySelector(".favorite-btn");

        if (!button) return;

        const saved = favorites.some(item => item.text === fullText);

        button.textContent = saved ? "★" : "☆";
        button.classList.toggle("is-favorite", saved);
        button.title = saved ? "Remove from favorites" : "Add to favorites";
        button.setAttribute(
            "aria-label",
            saved ? "Remove caption from favorites" : "Add caption to favorites"
        );
    });
}

if (clearFavoritesBtn) clearFavoritesBtn.addEventListener("click", () => {
    const favorites = getFavorites();

    if (favorites.length === 0) return;

    if (window.confirm("Are you sure you want to remove all favorites?")) {
        saveFavorites([]);
        renderFavorites();
        refreshFavoriteButtons();
    }
});

// Display saved favorites when the page opens.
renderFavorites();

// -----------------------------
// DOWNLOAD CAPTIONS
// -----------------------------

if (downloadAllBtn) downloadAllBtn.addEventListener("click", () => {
    if (!latestCaptions || latestCaptions.length === 0) {
        alert("Please generate captions before downloading.");
        return;
    }

    const content = latestCaptions
        .map((caption, index) => {
            return `OPTION ${index + 1}\n\n${getFullCaptionText(caption)}`;
        })
        .join("\n\n================================\n\n");

    const blob = new Blob([content], {
        type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "CaptionCraft_Captions.txt";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
});

// -----------------------------
// DASHBOARD STATISTICS
// -----------------------------

const TOTAL_GENERATIONS_KEY = "captionCraftTotalGenerations";
const TOTAL_CAPTIONS_KEY = "captionCraftTotalCaptions";

function getSavedNumber(key) {
    return Number(localStorage.getItem(key)) || 0;
}

function updateDashboardStats() {
    const totalGenerations = getSavedNumber(TOTAL_GENERATIONS_KEY);
    const totalCaptions = getSavedNumber(TOTAL_CAPTIONS_KEY);
    const totalFavorites = getFavorites().length;
    const totalHistory = getHistory().length;

    if (totalGenerationsElement) totalGenerationsElement.textContent = totalGenerations;
    if (captionsCreatedElement) captionsCreatedElement.textContent = totalCaptions;
    if (savedFavoritesElement) savedFavoritesElement.textContent = totalFavorites;
    if (historyAvailableElement) historyAvailableElement.textContent = totalHistory;
}

// Run whenever the page opens.
updateDashboardStats();

if (resultsList) {
    const requestedId = new URLSearchParams(window.location.search).get("id");
    const historyEntry = getHistory().find(entry => entry.id === requestedId)
        || getHistory()[0];

    if (historyEntry) {
        currentResultEntry = historyEntry;
        displayCaptions(historyEntry.captions, historyEntry.overallNote, historyEntry.topic);
    }
}