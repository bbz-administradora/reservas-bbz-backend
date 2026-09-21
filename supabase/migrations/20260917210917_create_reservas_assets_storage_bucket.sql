-- Bucket público de assets dinâmicos do sistema de reservas.
-- Substitui o bucket S3 gestao-bbz-app-assets preservando o layout de chaves
-- (images/espacos/*.webp e images/espacos/qrcode/*.png), para que as 131 linhas
-- de spaces que guardam caminho relativo não precisem ser reescritas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reservas-assets',
  'reservas-assets',
  true,
  5242880, -- 5 MB; maior objeto atual no S3 tem 112 KB
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública explícita. O bucket público já serve /object/public/** sem
-- policy, mas a policy deixa a intenção registrada no schema.
drop policy if exists "reservas_assets_public_read" on storage.objects;
create policy "reservas_assets_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'reservas-assets');

-- Escrita: nenhuma policy de insert/update/delete é criada de propósito.
-- O back-end escreve com a service_role key, que ignora RLS. Sem policy,
-- anon e authenticated não conseguem gravar nem apagar objetos.
;
