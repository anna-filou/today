/**
 * Emoji Auto-tag Module
 * Maps keywords to emojis for automatic task tagging.
 * Edit the EMOJI_WORD_BANK array to customize words and emojis.
 * Priority: First match wins (words higher in the list take precedence).
 */

const EMOJI_WORD_BANK = [
    // Shopping & Errands
    { word: 'buy', emoji: '🛒' },
    { word: 'market', emoji: '🛒' },
    { word: 'shop', emoji: '🛍️' },
    { word: 'groceries', emoji: '🥬' },
    { word: 'pick up', emoji: '📦' },
    { word: 'return', emoji: '↩️' },
    
    // Communication
    { word: 'watch', emoji: '👀' },
    { word: 'call', emoji: '☎️' },
    { word: 'email', emoji: '📧' },
    { word: 'text', emoji: '💬' },
    { word: 'message', emoji: '💬' },
    { word: 'reply', emoji: '↪️' },
    { word: 'talk', emoji: '🗣️' },

    { word: 'play', emoji: '🎲' },
    
    // Work & Productivity
    { word: 'meeting', emoji: '📅' },
    { word: 'presentation', emoji: '📊' },
    { word: 'report', emoji: '📝' },
    { word: 'deadline', emoji: '⏰' },
    { word: 'submit', emoji: '📤' },
    { word: 'review', emoji: '🔍' },
    
    // Health & Fitness
    { word: 'gym', emoji: '🏋️' },
    { word: 'workout', emoji: '💪' },
    { word: 'exercise', emoji: '💪' },
    { word: 'run', emoji: '🏃' },
    { word: 'walk', emoji: '🚶' },
    { word: 'yoga', emoji: '🧘' },
    { word: 'stretch', emoji: '🧘' },
    { word: 'doctor', emoji: '🩺' },
    { word: 'dentist', emoji: '🦷' },
    { word: 'meditate', emoji: '🧘' },
    
    // Food & Drink
    { word: 'coffee', emoji: '☕' },
    { word: 'tea', emoji: '🍵' },
    { word: 'lunch', emoji: '🍽️' },
    { word: 'dinner', emoji: '🍽️' },
    { word: 'cook', emoji: '🍳' },
    { word: 'breakfast', emoji: '🥞' },
    
    // Home & Chores
    { word: 'clean', emoji: '🧹' },
    { word: 'laundry', emoji: '🧺' },
    { word: 'dishes', emoji: '🍽️' },
    { word: 'vacuum', emoji: '🧹' },
    { word: 'organize', emoji: '📂' },
    { word: 'fix', emoji: '🔧' },
    { word: 'repair', emoji: '🔧' },
    
    // Learning & Study
    { word: 'study', emoji: '📚' },
    { word: 'read', emoji: '📖' },
    { word: 'learn', emoji: '🎓' },
    { word: 'practice', emoji: '🎯' },
    { word: 'homework', emoji: '📝' },
    
    // Finance
    { word: 'pay', emoji: '💸' },
    { word: 'bill', emoji: '🧾' },
    { word: 'bank', emoji: '🏦' },
    { word: 'budget', emoji: '💰' },
    
    // Travel & Transport
    { word: 'flight', emoji: '✈️' },
    { word: 'hotel', emoji: '🏨' },
    { word: 'pack', emoji: '🧳' },
    { word: 'trip', emoji: '🗺️' },
    { word: 'drive', emoji: '🚗' },
    { word: 'driving', emoji: '🚗' },
    { word: 'parking', emoji: '🅿️' },
    { word: 'ticket', emoji: '🎟️' },
    
    // Social
    { word: 'party', emoji: '🎉' },
    { word: 'birthday', emoji: '🎂' },
    { word: 'gift', emoji: '🎁' },
    { word: 'visit', emoji: '👋' },
    
    // Creative & Misc
    { word: 'write', emoji: '✍️' },
    { word: 'design', emoji: '🎨' },
    { word: 'draw', emoji: '✏️' },
    { word: 'photo', emoji: '🖼️' },
    { word: 'video', emoji: '🎬' },
    { word: 'music', emoji: '🎵' },
    { word: 'movie', emoji: '🍿' },
    { word: 'cinema', emoji: '🍿' },
    { word: 'series', emoji: '🍿' },
    { word: 'theater', emoji: '🎭' },
    { word: 'water', emoji: '💧' },
    { word: 'plant', emoji: '🌱' },
    { word: 'dog', emoji: '🐕' },
    { word: 'cat', emoji: '🐈' },
    { word: 'vet', emoji: '🏥' },
    
    // Personal Care
    { word: 'haircut', emoji: '💈' },
    { word: 'bathroom', emoji: '🚽' },
    { word: 'eat', emoji: '🍴' },
    
    // Tech & Digital
    { word: 'code', emoji: '💻' },
    { word: 'coding', emoji: '💻' },
    { word: 'laptop', emoji: '💻' },
    { word: 'download', emoji: '⬇️' },
    { word: 'update', emoji: '🔄' },
    { word: 'files', emoji: '📁' },
    { word: 'Notion', emoji: '📓' },
    
    // Planning & Notes
    { word: 'agenda', emoji: '📝' },
    { word: 'plan', emoji: '📝' },
    { word: 'notes', emoji: '📝' },
    { word: 'note', emoji: '📝' },
    { word: 'spec', emoji: '📄' },
    { word: 'specs', emoji: '📄' },
    { word: 'intro', emoji: '🗓️' },
    { word: 'feedback', emoji: '💬' },
    
    // Transport (additional)
    { word: 'car', emoji: '🚗' },
    { word: 'bus', emoji: '🚌' },
    { word: 'courier', emoji: '📦' },
    
    // Shopping & Delivery (additional)
    { word: 'package', emoji: '📦' },
    { word: 'invoice', emoji: '🧾' },
    { word: 'check out', emoji: '👉' },
    { word: 'try', emoji: '👉' },
    { word: 'add', emoji: '➕' },

    // Custom
    { word: 'WaniKani', emoji: '🦀' },
    { word: 'Jest', emoji: '❇️' },
    { word: 'Inuyasha', emoji: '🍿' },
    { word: 'portfolio', emoji: '💻' },
    { word: 'beach', emoji: '🏖️' },
    { word: 'lake', emoji: '🏞️' },
    { word: 'wash', emoji: '🧼' },
    { word: 'shower', emoji: '🚿' },
];

/**
 * Returns the task text with an emoji prepended if a keyword matches.
 * @param {string} text - The task text to process
 * @returns {string} - The text with emoji prefix, or original text if no match
 */
function applyEmojiToTask(text) {
    if (!text) return text;
    const lowerText = text.toLowerCase();
    for (const { word, emoji } of EMOJI_WORD_BANK) {
        if (lowerText.includes(word.toLowerCase())) {
            return `${emoji} ${text}`;
        }
    }
    return text;
}
