const escapeVCardText = value => String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/([;,])/g, '\\$1');

const buildDonorVCard = user => {
    const fields = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${escapeVCardText(user.name)}`,
        'ORG:BloodMatch',
        `NOTE:${escapeVCardText(`Blood group: ${user.bloodGroup || 'Not set'}`)}`
    ];
    if (user.location) fields.push(`ADR;TYPE=WORK:;;${escapeVCardText(user.location)};;;;`);
    if (user.qrSharePhone && user.phone) fields.push(`TEL;TYPE=CELL:${escapeVCardText(user.phone)}`);
    fields.push('END:VCARD');
    return fields.join('\r\n');
};

if (typeof module !== 'undefined' && module.exports) module.exports = buildDonorVCard;
