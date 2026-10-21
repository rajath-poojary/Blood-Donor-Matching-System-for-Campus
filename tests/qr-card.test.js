const assert = require('node:assert/strict');
const { test } = require('node:test');
const buildDonorVCard = require('../js/qr-card.js');

test('donor QR vCard contains the contact details shown on the card', () => {
    const card = buildDonorVCard({
        name: 'Alex Donor',
        bloodGroup: 'O+',
        location: 'North Campus'
    });

    assert.equal(card, [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'FN:Alex Donor',
        'ORG:BloodMatch',
        'NOTE:Blood group: O+',
        'ADR;TYPE=WORK:;;North Campus;;;;',
        'END:VCARD'
    ].join('\r\n'));
});

test('donor QR omits phone by default and includes it only after consent', () => {
    const donor = {
        name: 'Alex Donor',
        bloodGroup: 'O+',
        location: 'North Campus',
        phone: '+1 555 0100'
    };

    assert.doesNotMatch(buildDonorVCard(donor), /TEL;TYPE=CELL/);
    assert.match(buildDonorVCard({ ...donor, qrSharePhone: true }), /TEL;TYPE=CELL:\+1 555 0100/);
});

test('donor QR escapes vCard delimiters and line breaks', () => {
    const card = buildDonorVCard({
        name: 'Alex; Donor\nInjected',
        bloodGroup: 'A+',
        location: 'Building, Floor; Room'
    });

    assert.match(card, /FN:Alex\\; Donor\\nInjected/);
    assert.match(card, /ADR;TYPE=WORK:;;Building\\, Floor\\; Room;;;;/);
    assert.equal(card.split('\r\n').filter(line => line === 'Injected').length, 0);
});
