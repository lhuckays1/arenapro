import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConfirmationButton } from '../api/whatsapp/confirmation-button.js';

test('creates a single-button confirmation and hides the reply code from the message text', () => {
  const result = buildConfirmationButton(
    'Perfeito, Lucas! Sua oferta para Areia 1 foi criada. O valor é R$ 60,00. Para confirmar sua reserva, responda *SIM 43CF4F08* em até 15 minutos.',
  );

  assert.ok(result);
  assert.equal(result.confirmationCode, '43CF4F08');
  assert.equal(result.title, 'Sua reserva está quase confirmada');
  assert.match(result.description, /Areia 1/);
  assert.match(result.description, /R\$ 60,00/);
  assert.match(result.description, /Confirmar reserva/);
  assert.doesNotMatch(result.description, /43CF4F08/);
});

test('does not turn ordinary chat replies into a confirmation button', () => {
  assert.equal(buildConfirmationButton('Olá! Como posso ajudar?'), null);
  assert.equal(buildConfirmationButton('Oferta disponível. Responda SIM 43CF4F08.'), null);
  assert.equal(buildConfirmationButton('Confirme sua reserva com SIM 43CF4F0.'), null);
});
