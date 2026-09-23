# Princípios operacionais de Clean Code

Esta referência cobre os grupos de princípios da edição clássica de *Clean Code* em redação operacional própria. Usar como mapa de decisão, não como substituto do contexto do sistema nem como catálogo de regras absolutas.

## Sumário

1. [Postura e regra de melhoria contínua](#1-postura-e-regra-de-melhoria-contínua)
2. [Nomes](#2-nomes)
3. [Funções](#3-funções)
4. [Comentários](#4-comentários)
5. [Formatação e leitura](#5-formatação-e-leitura)
6. [Objetos e estruturas de dados](#6-objetos-e-estruturas-de-dados)
7. [Tratamento de erros](#7-tratamento-de-erros)
8. [Fronteiras e código de terceiros](#8-fronteiras-e-código-de-terceiros)
9. [Testes](#9-testes)
10. [Classes e módulos](#10-classes-e-módulos)
11. [Sistemas e construção](#11-sistemas-e-construção)
12. [Design emergente](#12-design-emergente)
13. [Concorrência](#13-concorrência)
14. [Refinamento sucessivo](#14-refinamento-sucessivo)
15. [Smells e heurísticas transversais](#15-smells-e-heurísticas-transversais)
16. [Como aplicar sem dogma](#16-como-aplicar-sem-dogma)

## 1. Postura e regra de melhoria contínua

- Otimizar para leitura: código é lido e modificado muito mais vezes do que é escrito inicialmente.
- Manter o repositório um pouco melhor após cada mudança, sem transformar a tarefa em reforma ilimitada.
- Assumir responsabilidade pela qualidade; não usar prazo, legado ou ferramenta como justificativa automática para aumentar desordem.
- Tratar limpeza como habilidade iterativa: escrever, testar, observar, reorganizar e simplificar.
- Preferir clareza explícita a esperteza compacta.
- Avaliar qualidade pela facilidade de entender intenção, localizar comportamento, testar e mudar com segurança.

## 2. Nomes

- Revelar intenção: expressar por que algo existe, o que representa e como deve ser usado.
- Evitar informação enganosa: não usar nomes que sugiram tipo, unidade, coleção, estado ou comportamento diferente do real.
- Criar distinções sem ruído: não diferenciar conceitos apenas com sufixos vagos como `data`, `info`, `object`, números ou grafias quase iguais.
- Preferir nomes pronunciáveis e pesquisáveis; reservar nomes curtíssimos para escopos minúsculos e convenções inequívocas.
- Evitar codificar tipo, escopo, interface ou implementação no nome quando a linguagem e as ferramentas já carregarem essa informação.
- Evitar exigir tradução mental, abreviações locais obscuras, trocadilhos e nomes “espertos”.
- Usar substantivos para tipos e valores; usar verbos ou frases verbais para operações e efeitos.
- Manter uma palavra por conceito quando os comportamentos forem equivalentes; não alternar sem motivo entre `fetch`, `get`, `load` e `retrieve`.
- Não reutilizar a mesma palavra para operações semanticamente diferentes.
- Usar termos técnicos conhecidos quando o conceito for técnico e vocabulário do negócio quando o conceito pertencer ao domínio.
- Acrescentar contexto suficiente por módulo, tipo ou nome; remover prefixos redundantes que apenas repetem o contexto global.
- Renomear quando a compreensão mudou; não preservar ambiguidade apenas por familiaridade.

Perguntas de verificação:

- Um leitor consegue prever o papel do símbolo sem abrir sua implementação?
- O nome continua correto em estados de erro, vazio ou borda?
- O nome descreve o conceito ou apenas o mecanismo atual?

## 3. Funções

- Manter cada função focada em uma responsabilidade observável e em um nível de abstração coerente.
- Extrair blocos quando um nome acrescentar significado e permitir leitura descendente do fluxo; não extrair mecanicamente por quantidade de linhas.
- Organizar funções para que a narrativa vá da política de alto nível aos detalhes.
- Encapsular condicionais extensas e dispatch por tipo quando isso reduzir repetição e acoplamento; aceitar `switch` local quando ele for a forma mais clara e estável.
- Dar nomes descritivos, mesmo que um pouco mais longos, em vez de comentários compensatórios.
- Minimizar argumentos porque cada argumento aumenta estados e acoplamento; agrupar apenas valores que formem um conceito real.
- Evitar argumentos booleanos de modo quando eles fizerem a função executar operações diferentes; preferir operações nomeadas.
- Evitar argumentos de saída; retornar um valor ou alterar explicitamente o objeto responsável.
- Separar consulta de comando quando misturá-las tornar efeitos surpreendentes.
- Evitar efeitos colaterais ocultos, dependência em ordem temporal e mutação distante.
- Preferir exceções ou resultados tipados a códigos mágicos de erro, conforme as convenções da linguagem e do sistema.
- Isolar a mecânica de `try/catch` quando ela obscurecer a política principal, sem espalhar wrappers inúteis.
- Remover duplicação de conhecimento; não confundir semelhança textual com conhecimento compartilhado.
- Preferir fluxo estruturado com poucas saídas surpreendentes; aceitar retornos antecipados quando eles reduzirem aninhamento e deixarem precondições claras.
- Refinar funções em ciclos apoiados por testes; não esperar que a primeira versão já tenha a forma final.

Sinais de responsabilidade múltipla:

- blocos que podem ser nomeados como etapas independentes;
- mudança de nível de abstração dentro do mesmo fluxo;
- muitos motivos distintos para mudar;
- necessidade de comentário separador por seção;
- combinações de argumentos que habilitam subcomportamentos diferentes.

## 4. Comentários

- Preferir tornar o código autoexplicativo por nomes, tipos e estrutura antes de comentar.
- Comentar contexto que o código não expressa: motivo, restrição externa, consequência incomum, decisão de compatibilidade, alerta de segurança ou exemplo de contrato público.
- Preservar avisos legais exigidos e esclarecer formatos externos ou algoritmos incomuns quando uma explicação curta impedir interpretação errada.
- Manter documentação de API precisa quando ela for parte do contrato.
- Registrar `TODO` somente quando houver ação clara e, se a convenção permitir, owner ou referência rastreável.
- Não resmungar sem contexto, repetir o código em prosa, narrar sintaxe, declarar o óbvio ou usar comentário como seção de organização.
- Não conservar código comentado; o controle de versão já preserva histórico.
- Não adicionar comentários por obrigação quando eles não comunicarem informação útil.
- Não usar diários de alteração, atribuições de autoria, marcadores de fechamento, banners decorativos ou ruído gerado automaticamente como substituto do histórico e da estrutura.
- Evitar HTML desnecessário, explicações longas, informação distante do elemento comentado e referências que o leitor não consegue localizar.
- Manter comentários próximos do alvo, específicos e atualizados; comentário enganoso é pior que ausência.
- Não usar comentário para justificar função, nome ou estrutura confusa que pode ser corrigida localmente.

## 5. Formatação e leitura

- Seguir formatador e convenções do repositório; consistência de equipe prevalece sobre preferência individual.
- Organizar o arquivo como narrativa: conceito público ou política antes de detalhes relacionados, respeitando os padrões da linguagem.
- Aproximar elementos fortemente relacionados e separar conceitos distintos com espaço ou módulos.
- Manter dependências conceituais visíveis; evitar obrigar o leitor a saltar entre arquivos sem benefício de isolamento.
- Usar indentação para representar estrutura real, nunca para esconder blocos ou compactar múltiplas ações.
- Limitar largura e tamanho de arquivo de forma contextual; quebrar quando isso melhorar leitura e responsabilidade, não para satisfazer número arbitrário.
- Remover ruído visual, alinhamentos frágeis e formatação manual que o formatter desfará.

## 6. Objetos e estruturas de dados

- Distinguir comportamento encapsulado de transporte de dados. Não criar getters e setters automáticos e chamar isso de encapsulamento.
- Pedir ao objeto que execute a regra quando ela depender de seus invariantes; evitar buscar seus dados para executar a regra fora dele.
- Usar estruturas de dados/DTOs quando a necessidade real for expor valores e permitir transformações externas.
- Evitar híbridos que exponham estado interno e também tentem controlar todo comportamento.
- Minimizar conhecimento de colaboradores internos: falar com dependências diretas e não navegar cadeias profundas de objetos.
- Aplicar a Lei de Demeter como guia de acoplamento, não como proibição cega de encadeamento fluente ou acesso a DTOs.
- Representar ausência explicitamente quando `null` puder criar ambiguidade; usar tipos opcionais, coleções vazias ou objeto nulo somente quando a semântica ficar mais clara.
- Preservar invariantes no limite mais próximo dos dados responsáveis.
- Escolher objetos, records, mapas ou estruturas imutáveis conforme o domínio e a linguagem, não por preferência universal.

## 7. Tratamento de erros

- Manter o caminho feliz legível sem esconder falhas relevantes.
- Usar o mecanismo idiomático da linguagem: exceções, resultados tipados ou erros explícitos; evitar códigos mágicos e estados parcialmente válidos.
- Acrescentar contexto útil no nível que conhece a operação, sem duplicar logs em todas as camadas.
- Definir tipos/mensagens de erro em termos da necessidade do chamador e da recuperação possível, não apenas da biblioteca subjacente.
- Não capturar erro amplo para ignorar, retornar sucesso falso ou continuar com estado corrompido.
- Separar falha esperada de defeito de programação.
- Evitar retornar ou aceitar `null` sem contrato explícito; validar na fronteira e reduzir propagação de nulabilidade.
- Garantir limpeza de recursos, atomicidade e invariantes em caminhos de erro.
- Não revelar segredos, dados pessoais ou detalhes internos indevidos em mensagens e logs.
- Projetar retry, fallback e idempotência apenas onde a operação e a falha permitirem.

## 8. Fronteiras e código de terceiros

- Conter APIs externas atrás de uma fronteira pequena quando isso reduzir disseminação de tipos, semântica instável ou detalhes de vendor.
- Não criar wrapper por rotina; exigir risco de mudança, dificuldade de teste ou tradução de domínio concreta.
- Escrever testes de aprendizagem para explorar biblioteca desconhecida ou registrar comportamento crítico dependente da versão.
- Adaptar entradas e saídas externas ao vocabulário interno na borda.
- Validar dados não confiáveis antes de permitir que atravessem o sistema.
- Manter dependência ainda inexistente atrás de um contrato mínimo guiado pelo consumidor quando o trabalho precisar avançar em paralelo.
- Atualizar bibliotecas com testes que detectem mudanças de contrato relevante.

## 9. Testes

- Tratar teste como código de produção: legível, organizado, revisado e simples de mudar.
- Escrever teste pequeno em torno de um comportamento ou conceito; permitir múltiplas asserções quando elas comprovarem o mesmo comportamento.
- Manter preparação, ação e verificação distinguíveis.
- Nomear o teste pelo cenário e resultado esperado, evitando nomes ligados apenas ao método interno.
- Favorecer testes rápidos, independentes, repetíveis, autoavaliáveis e escritos no momento útil do desenvolvimento; interpretar FIRST como direção, não acrônimo coercitivo.
- Evitar dependência entre testes, tempo real, rede aleatória, ordem global e dados compartilhados mutáveis.
- Usar helpers e builders que revelem intenção; não esconder o comportamento importante em abstrações de teste genéricas.
- Testar bordas, erros e invariantes além do caminho feliz.
- Preferir testes pelo contrato observável; testar detalhe privado somente quando o custo de acoplamento for consciente.
- Aplicar TDD quando ele ajudar a orientar design e segurança, sem alegar que a ordem de escrita por si só garante qualidade.
- Manter a pirâmide e os níveis de teste adequados ao risco do sistema; não substituir integração necessária por mocks excessivos.
- Não perseguir cobertura numérica isolada; procurar evidência sobre comportamentos relevantes.

## 10. Classes e módulos

- Manter cada classe ou módulo com propósito coeso e pequeno conjunto de motivos relacionados para mudar.
- Nomear pela responsabilidade; dificuldade de nomear pode indicar escopo difuso.
- Medir “pequeno” por responsabilidades e dependências, não por linhas.
- Manter estado encapsulado; expor para testes somente quando isso também melhorar o design de produção.
- Agrupar métodos e dados que mudam juntos; baixa coesão persistente sugere extração de um conceito.
- Depender de contratos estáveis em pontos de volatilidade; não criar interface para cada classe sem consumidor alternativo ou fronteira real.
- Isolar detalhes que mudam por razões diferentes e permitir extensão onde existe variação conhecida.
- Aplicar SRP, OCP e DIP como instrumentos para reduzir custo de mudança, não como meta de quantidade de camadas.
- Preferir composição quando herança criar acoplamento ou contrato frágil; usar herança quando a substituição semântica for verdadeira.

## 11. Sistemas e construção

- Separar montagem/configuração do uso cotidiano dos objetos.
- Concentrar decisões de criação em entry point, factory ou mecanismo de injeção compatível com o projeto.
- Evitar service locator, singleton global e estado ambiental oculto quando eles dificultarem teste e raciocínio.
- Adiar decisões arquiteturais somente quando houver fronteiras que mantenham a opção aberta e feedback capaz de informar a escolha.
- Crescer o sistema por incrementos executáveis, não por arquitetura especulativa completa.
- Modularizar interesses transversais — logs, transações, autorização — sem esconder o fluxo de negócio ou criar magia difícil de rastrear.
- Usar padrões e DSLs apenas quando melhorarem o vocabulário e reduzirem repetição conceitual.
- Validar a arquitetura continuamente por testes, dependências e capacidade de mudança.

## 12. Design emergente

Buscar simultaneamente quatro propriedades:

1. O sistema comprova o comportamento esperado por testes adequados.
2. A estrutura remove duplicação de conhecimento.
3. O código comunica intenção com nomes, responsabilidades e fluxo claros.
4. O número de elementos permanece mínimo para cumprir as três propriedades anteriores.

Usar essa ordem como proteção contra abstração prematura: correção vem antes da elegância, e expressividade não justifica estruturas sem função.

## 13. Concorrência

- Separar política concorrente da lógica de negócio sempre que possível.
- Limitar e proteger dados compartilhados; preferir imutabilidade, cópias, mensagens ou ownership claro.
- Entender operações atômicas da plataforma e não presumir atomicidade composta.
- Manter seções críticas pequenas, mas completas; evitar locks espalhados sem protocolo único.
- Projetar para shutdown, cancelamento, timeout, falha parcial e recursos limitados.
- Evitar deadlock definindo ordem de aquisição, reduzindo locks ou eliminando espera circular.
- Tornar workers independentes quando o domínio permitir.
- Testar sob diferentes ordens, cargas e repetições; falha rara continua sendo falha.
- Não mascarar problema de concorrência com sleeps ou timeouts arbitrários.
- Usar ferramentas de detecção, tracing e métricas disponíveis para obter evidência.
- Documentar invariantes e modelo de sincronização quando eles não forem óbvios pelo código.

## 14. Refinamento sucessivo

- Começar com solução correta e simples o bastante para aprender com ela.
- Construir proteção por testes antes de alterar estrutura complexa.
- Fazer transformações pequenas, mantendo o sistema executável entre etapas.
- Separar responsabilidades que emergirem durante o trabalho.
- Renomear conforme o modelo mental melhora.
- Remover duplicação e complexidade depois de identificar conceitos reais.
- Revisar o resultado final como leitor, não apenas como autor da sequência de patches.
- Parar quando o objetivo estiver atingido; limpeza sem limite também gera risco e custo.

## 15. Smells e heurísticas transversais

Usar os códigos abaixo apenas para rastrear a cobertura do catálogo clássico. Relatar o problema em linguagem do projeto, nunca como código isolado.

### Comentários e documentação

| Código | Diagnóstico operacional |
| --- | --- |
| C1 | A informação pertence a outro sistema, como controle de versão, issue tracker ou documentação operacional. |
| C2 | O comentário ficou obsoleto e contradiz ou não acompanha o código. |
| C3 | O comentário apenas repete o que a sintaxe já informa. |
| C4 | A redação é vaga, incorreta ou não permite localizar o motivo descrito. |
| C5 | Código desativado foi mantido em comentário em vez de removido. |

### Ambiente e automação

| Código | Diagnóstico operacional |
| --- | --- |
| E1 | Construir o projeto exige mais etapas manuais do que a automação justifica. |
| E2 | Executar a suíte exige preparação manual, seleção ad hoc ou ambiente não reproduzível. |

### Funções

| Código | Diagnóstico operacional |
| --- | --- |
| F1 | A quantidade ou combinação de argumentos torna chamadas difíceis de compreender e testar. |
| F2 | Argumento de saída cria mutação surpreendente ou contrato ambíguo. |
| F3 | Flag seleciona operações distintas que merecem nomes ou fluxos separados. |
| F4 | Função sem consumidor ou caminho alcançável acrescenta ruído e manutenção. |

### Estrutura geral

| Código | Diagnóstico operacional |
| --- | --- |
| G1 | O arquivo mistura linguagens, formatos ou mecanismos sem uma fronteira necessária. |
| G2 | Um comportamento esperado e evidente foi omitido, obrigando o consumidor a compensar. |
| G3 | Limites, vazios, mínimos, máximos ou transições de borda possuem regra incorreta. |
| G4 | Proteção, validação ou safety check foi desabilitado para contornar um problema. |
| G5 | Conhecimento ou regra foi duplicado e pode divergir. |
| G6 | Política de alto nível contém detalhe baixo, ou detalhe baixo decide política indevida. |
| G7 | Abstração base conhece derivados ou implementações concretas sem necessidade estrutural. |
| G8 | Módulo expõe tipos, métodos, constantes ou estado além do contrato necessário. |
| G9 | Código, estado, configuração ou branch não possui uso alcançável. |
| G10 | Conceitos intimamente relacionados estão fisicamente distantes sem benefício de isolamento. |
| G11 | O código quebra uma convenção local estável sem motivo explícito. |
| G12 | Construtores vazios, variáveis redundantes, comentários-ruído ou estruturas sem função acumulam desordem. |
| G13 | Elementos foram acoplados apenas por conveniência de localização, utilitário ou organização artificial. |
| G14 | Um módulo manipula mais os dados e regras de outro do que os próprios. |
| G15 | Seletor, tipo ou flag escolhe famílias de comportamento e torna extensão/combinação frágil. |
| G16 | Nomes fracos, valores mágicos, cadeia de chamadas ou expressão compacta escondem intenção. |
| G17 | Regra ou dado está localizado longe da responsabilidade que o conhece e protege. |
| G18 | Operação estática impede polimorfismo, ownership ou teste que o domínio realmente exige. |
| G19 | Cálculo complexo não usa variáveis intermediárias nomeadas para tornar passos e intenção visíveis. |
| G20 | O nome da função não permite prever efeito, resultado ou condição relevante. |
| G21 | A implementação parece funcionar por tentativa, mas o algoritmo e suas invariantes não estão compreendidos. |
| G22 | Dependência lógica não foi tornada dependência física, permitindo uso em ordem ou estado inválido. |
| G23 | Condicional por tipo cresce em vários lugares quando despacho polimórfico ou tabela de estratégias reduziria dispersão. |
| G24 | Convenção amplamente adotada pela linguagem, framework ou equipe foi ignorada sem ganho concreto. |
| G25 | Número ou string literal relevante não comunica nome, unidade, origem ou regra. |
| G26 | Código usa aproximação, fallback, tipo ou decisão imprecisa onde o contrato exige exatidão. |
| G27 | Convenção depende de disciplina humana quando tipos, encapsulamento ou estrutura poderiam impedir estado inválido. |
| G28 | Condicional complexa aparece em linha e poderia receber um nome que revele a decisão. |
| G29 | Condição negativa e ramificações invertidas aumentam custo de leitura sem necessidade. |
| G30 | Função mistura responsabilidades ou níveis de abstração que mudam por razões diferentes. |
| G31 | Ordem temporal obrigatória existe, mas o contrato não a torna visível nem impossível de violar. |
| G32 | Estrutura, nome ou comportamento é arbitrário e não segue domínio, convenção ou justificativa rastreável. |
| G33 | Valor de borda ou regra especial foi repetido em vários pontos em vez de encapsulado. |
| G34 | Leitura top-down salta entre abstrações e obriga o leitor a reconstruir a narrativa. |
| G35 | Configuração essencial está enterrada em detalhe baixo, dispersa ou duplicada. |
| G36 | Um módulo navega dependências transitivas e passa a conhecer a estrutura interna de uma cadeia de objetos. |

### Heurísticas específicas de linguagens com imports, herança e enums

| Código | Diagnóstico operacional |
| --- | --- |
| L1 | Lista extensa de imports prejudica sinal/ruído; usar mecanismo idiomático de agrupamento somente se não criar ambiguidade nem violar lint local. |
| L2 | Classe herda apenas para reutilizar constantes e cria uma relação de tipo falsa. |
| L3 | Constantes soltas representam conjunto fechado com comportamento/identidade e seriam melhor modeladas por enum ou tipo equivalente. |

Adaptar essas três heurísticas à linguagem atual. Não importar automaticamente a recomendação Java original para ecossistemas em que imports explícitos ou outros tipos sejam a convenção segura.

### Nomes

| Código | Diagnóstico operacional |
| --- | --- |
| N1 | Nome não descreve o conceito ou objetivo com precisão suficiente. |
| N2 | Nome revela detalhe de implementação em um nível que deveria expressar política ou domínio. |
| N3 | Vocabulário padrão do domínio, linguagem ou equipe foi trocado por sinônimo desnecessário. |
| N4 | Nome admite interpretações concorrentes relevantes. |
| N5 | Comprimento e especificidade do nome não correspondem ao alcance do símbolo. |
| N6 | Prefixo/sufixo codifica tipo, escopo ou mecanismo já expresso pela linguagem. |
| N7 | Nome omite efeito colateral, mutação, I/O ou consequência importante. |

### Testes

| Código | Diagnóstico operacional |
| --- | --- |
| T1 | Comportamento relevante não possui evidência automatizada suficiente. |
| T2 | Relatório de cobertura disponível não foi usado para localizar caminhos relevantes não exercitados. |
| T3 | Teste pequeno ou “óbvio” foi omitido apesar de proteger contrato ou borda real. |
| T4 | Teste desabilitado permanece sem decisão, justificativa ou acompanhamento. |
| T5 | Casos próximos aos limites e transições não foram exercitados. |
| T6 | Um bug conhecido foi corrigido sem teste que cubra sua família de causas e regressões plausíveis. |
| T7 | Padrão de falhas na suíte não foi investigado como pista de causa compartilhada. |
| T8 | Padrão de caminhos sem cobertura não foi usado para descobrir risco estrutural. |
| T9 | Teste lento impede feedback frequente sem que o nível de integração justifique o custo. |

Para cada smell, perguntar antes de agir: qual custo ele causa agora, qual mudança provável ele dificulta e qual é a menor correção segura?

## 16. Como aplicar sem dogma

- Preservar uma função longa quando ela for uma narrativa linear coesa e extrações só criarem saltos sem nomes úteis.
- Aceitar duplicação temporária quando os conceitos ainda não estiverem compreendidos ou tiverem razões diferentes para mudar.
- Usar comentário detalhado para algoritmo, workaround, protocolo, segurança ou decisão externa difícil de expressar no código.
- Manter estrutura orientada a dados onde transformação e serialização forem o objetivo natural.
- Aceitar dependência concreta quando não houver volatilidade, alternativa ou benefício de teste que pague a indireção.
- Priorizar desempenho quando medido ou requerido; cercar otimização complexa com nomes, testes e explicação do motivo.
- Seguir idioms da linguagem e framework mesmo quando diferirem dos exemplos Java da obra original.
- Preferir consistência local em código estável; introduzir convenção nova apenas com ganho claro e migração controlada.

Registrar exceções importantes no código somente quando o contexto precisar acompanhar a implementação; caso contrário, explicá-las na entrega ou decisão arquitetural apropriada.
