import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enrollmentEndDate } from '../src/utils/enrollment';
import { paymentRequestKey, completePaymentRequest } from '../src/utils/paymentRequest';

test('contratos mensais têm término inclusivo e respeitam fevereiro', () => {
  assert.equal(enrollmentEndDate('2026-10-01',1,'MONTHS'),'2026-10-31');
  assert.equal(enrollmentEndDate('2026-10-15',3,'MONTHS'),'2027-01-14');
  assert.equal(enrollmentEndDate('2026-01-31',1,'MONTHS'),'2026-02-27');
  assert.equal(enrollmentEndDate('2028-01-31',1,'MONTHS'),'2028-02-28');
});
test('contratos semanais cruzam meses e anos sem dia extra', () => {
  assert.equal(enrollmentEndDate('2026-12-28',1,'WEEKS'),'2027-01-03');
  assert.equal(enrollmentEndDate('2026-10-01',4,'WEEKS'),'2026-10-28');
});
test('duração e data inválidas não são normalizadas silenciosamente', () => {
  assert.throws(()=>enrollmentEndDate('2026-02-30',1,'MONTHS'));
  for (const duration of [0,-1,1.5,NaN,121]) assert.throws(()=>enrollmentEndDate('2026-10-01',duration,'MONTHS'));
});
test('repetição de recebimento mantém chave até confirmação', () => {
  const storage = new Map<string,string>();
  const original = Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)}});
  try {
    const first=paymentRequestKey('bar:test',{amount:10,method:'PIX'});
    assert.equal(paymentRequestKey('bar:test',{amount:10,method:'PIX'}),first);
    assert.notEqual(paymentRequestKey('bar:other',{amount:10,method:'PIX'}),first);
    completePaymentRequest('bar:test');
    assert.notEqual(paymentRequestKey('bar:test',{amount:10,method:'PIX'}),first);
  } finally {
    if (original) Object.defineProperty(globalThis,'sessionStorage',original);
    else Reflect.deleteProperty(globalThis,'sessionStorage');
  }
});
