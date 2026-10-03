import assert from 'node:assert/strict';
import test from 'node:test';
import { dockOpacity, runningApps, safeAppRoute } from '../public/euler-dock.js';

const origin = 'http://localhost:2713';

test('dock routes keep an app page, query, and hash on the Euler origin', () => {
  assert.equal(safeAppRoute('/app/innernet', 'innernet', origin), '/app/innernet');
  assert.equal(safeAppRoute('/app/innernet/', 'innernet', origin), '/app/innernet/');
  assert.equal(safeAppRoute(`${origin}/app/innernet/search?q=hello%20world#results`, 'innernet', origin),
    '/app/innernet/search?q=hello%20world#results');
  assert.equal(safeAppRoute('/app/alpha.beta_2-3/page', 'alpha.beta_2-3', origin), '/app/alpha.beta_2-3/page');
});

test('dock routes reject a different origin, credentials, or executable URL', () => {
  for (const route of [
    'https://example.com/app/innernet/',
    'http://localhost:4400/app/innernet/',
    'http://127.0.0.1:2713/app/innernet/',
    'https://localhost:2713/app/innernet/',
    '//example.com/app/innernet/',
    'http://user:password@localhost:2713/app/innernet/',
    'javascript:alert(1)',
    'data:text/html,hello',
  ]) assert.equal(safeAppRoute(route, 'innernet', origin), null, route);
});

test('dock routes cannot restore another app or escape the application prefix', () => {
  for (const route of [
    '/', '/manage', '/api/state', '/app/quitter/', '/app/innernet-other/',
    '/app/innernet/../quitter/', '/app/innernet/%2e%2e/quitter/',
    '/app/innernet/../../manage', '/app/innernet\\..\\quitter/',
  ]) assert.equal(safeAppRoute(route, 'innernet', origin), null, route);
});

test('dock route restoration tolerates invalid stored values and project IDs', () => {
  for (const value of [null, undefined, false, 10, {}, []]) {
    assert.equal(safeAppRoute(value, 'innernet', origin), null);
  }
  for (const id of [null, undefined, '', '../innernet', 'innernet/other', 'with space', '?id', '#id', {}, []]) {
    assert.equal(safeAppRoute('/app/innernet/', id, origin), null);
  }
  assert.equal(safeAppRoute('/app/innernet/', 'innernet', 'invalid origin'), null);
});

test('dock opacity rounds and bounds valid saved preferences', () => {
  assert.equal(dockOpacity(20), 20);
  assert.equal(dockOpacity('100'), 100);
  assert.equal(dockOpacity('64.6'), 65);
  assert.equal(dockOpacity(64.4), 64);
  assert.equal(dockOpacity('-50'), 20);
  assert.equal(dockOpacity(200), 100);
  assert.equal(dockOpacity('0'), 20);
});

test('dock opacity falls back for absent, malformed, or incorrectly typed preferences', () => {
  for (const value of [null, undefined, '', '  ', 'not a number', 'Infinity', NaN, Infinity, -Infinity, false, true, [], {}, Symbol('invalid')]) {
    assert.equal(dockOpacity(value), 72);
  }
});

test('dock includes only running compiled apps in workspace order', () => {
  const data = { projects: [
    { id: 'instants', name: 'Instants', hosting: 'compiled', status: 'running' },
    { id: 'stopped', name: 'Stopped', hosting: 'compiled', status: 'stopped' },
    { id: 'starting', name: 'Starting', hosting: 'compiled', status: 'starting' },
    { id: 'external', name: 'External', hosting: 'compiled', status: 'external' },
    { id: 'dynamic', name: 'Dynamic', hosting: 'process', status: 'running' },
    { id: 'innernet', name: 'Innernet', hosting: 'compiled', status: 'running' },
  ] };
  assert.deepEqual(runningApps(data), [
    { id: 'instants', name: 'Instants' }, { id: 'innernet', name: 'Innernet' },
  ]);
});

test('dock ignores malformed state and duplicate cached apps', () => {
  for (const value of [null, undefined, {}, { projects: null }, { projects: {} }]) {
    assert.deepEqual(runningApps(value), []);
  }
  assert.deepEqual(runningApps({ projects: [
    null, undefined, false, 42, 'innernet', {},
    { id: '../innernet', hosting: 'compiled', status: 'running' },
    { id: 'innernet', name: 'Innernet', hosting: 'compiled', status: 'running' },
    { id: 'innernet', name: 'Duplicate', hosting: 'compiled', status: 'running' },
  ] }), [{ id: 'innernet', name: 'Innernet' }]);
});

test('dock names have a usable fallback and bounded display length without changing source state', () => {
  const projects = [
    { id: 'alpha', name: 123, hosting: 'compiled', status: 'running' },
    { id: 'beta', name: 'B'.repeat(120), hosting: 'compiled', status: 'running' },
  ];
  const before = structuredClone(projects);
  assert.deepEqual(runningApps({ projects }), [{ id: 'alpha', name: 'alpha' }, { id: 'beta', name: 'B'.repeat(80) }]);
  assert.deepEqual(projects, before);
});
