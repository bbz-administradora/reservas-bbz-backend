---
name: design-system
description: Guardião do Design System do projeto. Use quando a tarefa envolver cor, tipografia, tokens, tema, dark mode, espaçamento, raio de canto, alvo de toque, componentes de biblioteca, botões, cards, tabelas, badges, selos de status, ícones, consistência visual, identidade de marca ou padronização de componentes. Garante que toda superfície nova pareça parte do mesmo sistema.
---

# Design System

Guardião da consistência visual. Tudo deve parecer parte do mesmo sistema. Esta skill não traz uma paleta nem uma tipografia próprias: ela descobre o design system que o projeto já tem e o defende.

## Descobrir antes de decidir

Nenhuma decisão visual antes de ler o que o projeto define. Nesta ordem:

1. Tema e tokens: `tailwind.config.*`, `src/index.css`/`app/globals.css`, arquivos de tema, `:root` e as variáveis CSS.
2. Documentação de marca no repositório: `docs/design`, `README`, guia de estilo, arquivos de brand, diretório de assets e logos.
3. Componentes existentes: a biblioteca base em uso (shadcn/ui, Radix, MUI, Chakra ou própria) e as variantes já criadas.
4. Telas comparáveis: como um card, uma tabela, um formulário e um selo de status já foram resolvidos.

O que o projeto já resolveu é a resposta. Quando um valor não existir em lugar nenhum, tratar como lacuna e perguntar ao usuário — não inventar cor, peso ou raio novo em silêncio.

## Paleta é fechada

Toda cor de tela vem da paleta definida no tema. Nunca definir cor solta numa tela, nunca introduzir cor fora da lista do projeto.

- Se o projeto declara cores legadas ou proibidas, respeitar a proibição em telas novas.
- Se o projeto tem uma convenção própria para estado (status, sucesso, atenção, erro), seguir essa convenção mesmo quando divergir do semáforo verde/amarelo/vermelho habitual. Uma linguagem de cor própria é decisão de marca; não substituí-la pela convenção genérica.
- Introduzir uma cor nova exige aprovação do usuário e entra como token, nunca como valor solto.

## Tokens (regra de ouro)

- NUNCA cor hardcoded em componente (sem `bg-[#04193b]` solto). Use tokens do tema: variáveis CSS e classes semânticas (`primary`, `secondary`, `accent`, `muted`, `destructive`, `background`, `foreground`, `border`).
- A paleta se define e se ajusta no tema central, com variáveis. Toda cor nova entra como token.
- Tema por token: claro e escuro se definem trocando as variáveis, não estilizando dentro do media query. Pares claro/escuro desde o início, com contraste testado nos dois.

## Tipografia

Uma escala só, a do projeto. Identificar a família, os pesos disponíveis e a escala em uso, e manter título, corpo, rótulo, número de destaque e badge dentro dela.

Não introduzir família nova, peso fora dos carregados nem tamanho fora da escala. Se a escala do projeto não estiver documentada, derivá-la das telas existentes e propor a tabela ao usuário antes de fixá-la.

## Forma, espaço e toque

- Raios, sombras e espaçamentos saem da escala do projeto; não inventar valor intermediário.
- Alvo de toque mínimo 44px; ação primária mais generosa; nunca fonte abaixo de 16px onde a pessoa executa a tarefa.
- Layout com `gap` em flex/grid; nada de margens soltas que colapsam. O espaço é do container.

## Componentes

- Usar a biblioteca base do projeto. Não recriar botão, card, dialog, input do zero; estender por variante, alinhada ao tema.
- Um CTA primário por tela; secundário/ghost para o resto.
- Ícones de uma família só, na que o projeto já usa, em tamanhos coerentes (16/20/24).
- Sombra sutil; nada de borda + sombra forte ao mesmo tempo.
- Logos e assets de marca: usar a variante correta para o fundo (negativa em superfície escura, positiva em fundo claro), conforme os arquivos do projeto.

## Consistência

- Tabelas, formulários, cabeçalhos de página e estados vazios seguem o mesmo padrão em todos os módulos.
- Densidade adequada ao uso real do produto; hierarquia tipográfica bem definida.
- Antes de criar um padrão novo, verifique se já existe componente ou estilo para reaproveitar.

## Antes de concluir

Sem cor fora do token e fora da paleta do projeto, assets de marca corretos para o fundo, estado comunicado pela convenção do projeto, dark mode coerente, alvos e raios dentro da escala, componentes reaproveitados, visual idêntico ao resto do sistema.
