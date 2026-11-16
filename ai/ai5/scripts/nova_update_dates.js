// Update these timestamps when the corresponding AI5 experience changes.
// The offsets record the time zone in effect when the changes were published.
const novaUpdateDates = {
    desktop: '2026-11-16T13:20:18-07:00',
    mobile: '2026-11-16T15:19:48-07:00'
};

function formatNovaUpdateDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid AI5 update date: ${value}`);
    const parts = new Intl.DateTimeFormat('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type).value;
    return `${part('month')}/${part('day')}/${part('year')} ${part('hour')}:${part('minute')} ${part('dayPeriod')}`;
}

document.querySelectorAll('[data-nova-update]').forEach(element => {
    const key = element.dataset.novaUpdate;
    if (!Object.prototype.hasOwnProperty.call(novaUpdateDates, key)) {
        console.error(`Unknown AI5 update date: ${key}`);
        return;
    }
    const value = novaUpdateDates[key];
    element.dateTime = value;
    element.textContent = formatNovaUpdateDate(value);
});
