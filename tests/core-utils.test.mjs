import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsername, validUsername } from '../src/lib/username.js';
import { compatibility, rankPeople } from '../src/lib/matching.js';

test('normaliza @, espaços e maiúsculas no nome de usuário', () => {
  assert.equal(normalizeUsername(' @Ana Silva_01 '), 'anasilva_01');
});

test('valida limites e formato do nome de usuário', () => {
  assert.equal(validUsername('ana.silva'), true);
  assert.equal(validUsername('ab'), false);
  assert.equal(validUsername('ana silva'), true); // normalização remove espaços antes de validar
  assert.equal(validUsername('a'.repeat(31)), false);
});

test('calcula compatibilidade por ajuda, interesses e contexto compartilhado', () => {
  const me = {
    need_help: ['Mandarim'],
    can_help: ['Inglês'],
    interests: ['Leitura'],
    institution: 'UNESP',
    city: 'Assis',
    course_or_role: 'Língua Chinesa',
  };
  const person = {
    name: 'Ana Silva',
    can_help: ['Mandarim'],
    need_help: ['Inglês'],
    interests: ['Leitura'],
    institution: 'Universidade Estadual Paulista Júlio de Mesquita Filho',
    city: 'Assis',
    course_or_role: 'Língua Chinesa',
  };
  const result = compatibility(me, person);
  assert.equal(result.score, 88);
  assert.deepEqual(result.receive, ['Mandarim']);
  assert.deepEqual(result.give, ['Inglês']);
  assert.deepEqual(result.shared, ['Leitura']);
});

test('ordena recomendações pela pontuação e depois pelo nome', () => {
  const me = { need_help: ['Mandarim'], can_help: [], interests: [] };
  const people = [
    { id: 'b', name: 'Bruna', can_help: [], need_help: [], interests: [] },
    { id: 'a', name: 'Ana', can_help: ['Mandarim'], need_help: [], interests: [] },
  ];
  const ranked = rankPeople(me, people);
  assert.equal(ranked[0].id, 'a');
  assert.ok(ranked[0].compatibility.score > ranked[1].compatibility.score);
});
