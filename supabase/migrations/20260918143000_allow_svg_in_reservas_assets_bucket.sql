-- Os 9 assets estáticos (ícones de e-mail, imagem de Open Graph e o SVG de 404)
-- passam a morar no próprio bucket, e não no public/ do front, para que o
-- back-end monte a URL dos e-mails sem depender de um deploy do front. Um deles
-- é image/svg+xml, MIME que o provisionamento original não previa.
--
-- Os SVG do bucket são estáticos versionados no export da migração: nenhuma
-- policy permite insert a anon/authenticated, e o endpoint de upload da API só
-- grava image/webp e image/png sob images/. O storage também responde em host
-- próprio, separado da origem da aplicação.
update storage.buckets
set allowed_mime_types = array[
  'image/webp',
  'image/png',
  'image/jpeg',
  'image/svg+xml'
]
where id = 'reservas-assets';
