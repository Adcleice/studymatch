-- StudyMatch — bibliotecas de referência nas 27 capitais
-- Importação ÚNICA para Supabase SQL Editor.
-- IMPORTANTE: estes registros vivem SOMENTE em public.places.
-- Não existe seed no frontend, useEffect ou rotina de recriação.
-- Assim, depois de importados, a administradora pode editar/excluir normalmente
-- e um local excluído NÃO reaparece.
--
-- A inserção é idempotente por nome+cidade+UF: executar novamente não duplica.
-- Fotos ficam NULL de propósito quando não há URL institucional estável/licenciada.
-- A administradora pode adicionar/trocar a foto pelo editor normal do app.

DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE lower(email)=lower('adcleice24@gmail.com') LIMIT 1;
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Conta administradora não encontrada em auth.users';
  END IF;

  INSERT INTO public.places (name,address,city,state,tags,photo_url,added_by,approved,avg_rating,review_count)
  SELECT v.name,v.address,v.city,v.state,ARRAY['Biblioteca','Gratuito']::text[],NULL,admin_id,true,0,0
  FROM (VALUES
    ('Biblioteca Pública Estadual Isaura Parente','Av. Getúlio Vargas, 389 — Centro','Rio Branco','AC'),
    ('Biblioteca Pública Estadual Graciliano Ramos','Praça Dom Pedro II — Centro','Maceió','AL'),
    ('Biblioteca Pública do Estado do Amapá Elcy Lacerda','Rua São José, 1800 — Centro','Macapá','AP'),
    ('Biblioteca Pública do Amazonas','Rua Barroso, 57 — Centro','Manaus','AM'),
    ('Biblioteca Central do Estado da Bahia','Rua General Labatut, 27 — Barris','Salvador','BA'),
    ('Biblioteca Pública Estadual do Ceará — BECE','Av. Presidente Castelo Branco, 255 — Moura Brasil','Fortaleza','CE'),
    ('Biblioteca Nacional de Brasília','Setor Cultural da República, Área Cívica, Lote s/n','Brasília','DF'),
    ('Biblioteca Pública do Espírito Santo Levy Cúrcio da Rocha','Av. João Batista Parra, 165 — Praia do Suá','Vitória','ES'),
    ('Biblioteca Estadual Pio Vargas','Praça Cívica, 2 — Setor Central','Goiânia','GO'),
    ('Biblioteca Pública Benedito Leite','Praça do Pantheon, s/n — Centro','São Luís','MA'),
    ('Biblioteca Pública Estadual Estevão de Mendonça','Palácio da Instrução, Praça da República, 151 — Centro','Cuiabá','MT'),
    ('Biblioteca Pública Estadual Dr. Isaías Paim','Av. Fernando Corrêa da Costa, 559 — Centro','Campo Grande','MS'),
    ('Biblioteca Pública Estadual de Minas Gerais','Praça da Liberdade, 21 — Funcionários','Belo Horizonte','MG'),
    ('Biblioteca Pública Arthur Vianna','Av. Gentil Bittencourt, 650 — Nazaré','Belém','PA'),
    ('Biblioteca Pública Estadual Juarez da Gama Batista','Espaço Cultural José Lins do Rego, Rua Abdias Gomes de Almeida, 800 — Tambauzinho','João Pessoa','PB'),
    ('Biblioteca Pública do Estado de Pernambuco','Rua João Lira, s/n — Santo Amaro','Recife','PE'),
    ('Biblioteca Estadual Cromwell de Carvalho','Praça Demóstenes Avelino, 1767 — Centro','Teresina','PI'),
    ('Biblioteca Pública do Paraná','Rua Cândido Lopes, 133 — Centro','Curitiba','PR'),
    ('Biblioteca Parque Estadual','Av. Presidente Vargas, 1261 — Centro','Rio de Janeiro','RJ'),
    ('Biblioteca Pública Estadual Câmara Cascudo','Rua Potengi, 535 — Petrópolis','Natal','RN'),
    ('Biblioteca Pública Estadual Dr. José Pontes Pinto','Rua José do Patrocínio, 134 — Centro','Porto Velho','RO'),
    ('Biblioteca Pública Estadual de Roraima','Av. Glaycon de Paiva, 1171 — Mecejana','Boa Vista','RR'),
    ('Biblioteca Pública do Estado do Rio Grande do Sul','Rua Riachuelo, 1190 — Centro Histórico','Porto Alegre','RS'),
    ('Biblioteca Pública de Santa Catarina','Rua Tenente Silveira, 343 — Centro','Florianópolis','SC'),
    ('Biblioteca Mário de Andrade','Rua da Consolação, 94 — República','São Paulo','SP'),
    ('Biblioteca Pública Estadual Epiphanio Dória','Rua Dr. Leonardo Leite, 964 — 13 de Julho','Aracaju','SE'),
    ('Biblioteca Pública Estadual Darcy Cardeal','Praça dos Girassóis — Plano Diretor Sul','Palmas','TO')
  ) AS v(name,address,city,state)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.places p
    WHERE lower(trim(p.name))=lower(trim(v.name))
      AND lower(trim(p.city))=lower(trim(v.city))
      AND upper(trim(p.state))=upper(trim(v.state))
  );
END $$;

-- Confirmação
SELECT name,city,state,approved
FROM public.places
WHERE city IN ('Rio Branco','Maceió','Macapá','Manaus','Salvador','Fortaleza','Brasília','Vitória','Goiânia','São Luís','Cuiabá','Campo Grande','Belo Horizonte','Belém','João Pessoa','Recife','Teresina','Curitiba','Rio de Janeiro','Natal','Porto Velho','Boa Vista','Porto Alegre','Florianópolis','São Paulo','Aracaju','Palmas')
ORDER BY state,city,name;
