# Checklist para revisão com Clean Code

Usar esta referência em revisão, auditoria, diagnóstico ou antes de concluir uma refatoração ampla. Não produzir uma lista mecânica: relatar somente achados com evidência e consequência relevante.

## Sumário

1. [Preparar a revisão](#1-preparar-a-revisão)
2. [Prioridade e confiança](#2-prioridade-e-confiança)
3. [Áreas de inspeção](#3-áreas-de-inspeção)
4. [Formato dos achados](#4-formato-dos-achados)
5. [Evitar falsos positivos](#5-evitar-falsos-positivos)
6. [Concluir](#6-concluir)

## 1. Preparar a revisão

- Confirmar o objetivo: diff, arquivo, módulo, fluxo ou repositório.
- Ler instruções locais, testes, tipos, chamadas e contratos associados.
- Comparar com a base correta quando a revisão for de mudança.
- Separar problema introduzido pelo diff de dívida preexistente.
- Executar checagens read-only relevantes quando autorizadas e viáveis.
- Não editar arquivos em um pedido somente de revisão.

## 2. Prioridade e confiança

Usar severidade pelo impacto, não pela quantidade de princípios envolvidos:

- **Crítica**: perda de dados, vulnerabilidade explorável, indisponibilidade ampla ou contrato essencial quebrado.
- **Alta**: bug provável, regressão importante, corrida, erro silencioso ou manutenção que induz falha recorrente.
- **Média**: ambiguidade ou acoplamento que torna mudança comum arriscada, teste relevante ausente ou tratamento de erro incompleto.
- **Baixa**: melhoria localizada com benefício real, mas sem risco imediato.

Indicar incerteza quando o impacto depender de contexto não verificado. Omitir preferência estética sem consequência.

## 3. Áreas de inspeção

### Comportamento e contratos

- A implementação cumpre requisitos e casos de borda?
- Entradas, saídas, erros, nulabilidade e efeitos colaterais permanecem compatíveis?
- Existe comportamento implícito em nomes, comentários ou testes que o código contradiz?

### Clareza e nomes

- Os símbolos comunicam intenção, unidade, estado e domínio?
- Há distinções falsas, abreviações obscuras ou vocabulário inconsistente?
- O fluxo pode ser entendido sem navegar por abstrações desnecessárias?

### Funções e fluxo

- Cada função mantém responsabilidade e nível de abstração coerentes?
- Flags, argumentos, mutações ou efeitos ocultam operações diferentes?
- Condicionais, loops e retornos deixam sucesso e falha compreensíveis?

### Dados, objetos e módulos

- Invariantes estão protegidos no lugar responsável?
- Há exposição indevida de estado, cadeia de conhecimento ou responsabilidade no módulo errado?
- A abstração representa conceito estável ou só remove repetição visual?

### Erros e fronteiras

- Falhas são propagadas, contextualizadas e recuperadas no nível correto?
- Dados externos são validados e traduzidos na borda?
- Logs preservam diagnóstico sem vazar dados sensíveis nem duplicar o mesmo erro?

### Testes

- Testes cobrem comportamento modificado, bordas e falha provável?
- São determinísticos, independentes e legíveis?
- Testam contrato ou estão acoplados demais a detalhes internos?

### Concorrência e estado

- Existe estado compartilhado sem ownership ou sincronização clara?
- Retry, cancelamento, timeout, ordem e idempotência foram considerados?
- A mudança cria race condition, deadlock, atualização perdida ou resultado obsoleto?

### Simplicidade e evolução

- Existe código morto, especulativo, duplicado conceitualmente ou configuração espalhada?
- A mudança adiciona camada, interface ou padrão sem pressão concreta?
- O diff contém limpeza adjacente que aumenta o risco ou esconde a alteração funcional?

## 4. Formato dos achados

Para cada achado, incluir:

```text
[Severidade] Título orientado ao problema
Local: caminho:linha ou símbolo
Evidência: comportamento ou trecho específico observado
Impacto: falha, risco ou custo concreto
Correção: menor direção segura, sem exigir reescrita desnecessária
Confiança: alta | média | baixa, quando não for óbvia
```

Agrupar ocorrências com a mesma causa em um achado e citar exemplos representativos. Manter a faixa de linhas curta o bastante para localizar o problema.

## 5. Evitar falsos positivos

Não relatar como defeito, sem evidência adicional:

- função ou arquivo apenas porque excede um tamanho preferido;
- mais de dois argumentos quando o contrato permanece claro e coeso;
- comentário que documenta decisão externa, protocolo ou risco real;
- duplicação que representa conceitos diferentes;
- ausência de interface para uma dependência estável e sem substitutos;
- uso idiomático do framework que difere do estilo do livro;
- micro-otimização estética sem impacto em entendimento ou mudança;
- código fora do diff que não é afetado pelo pedido.

## 6. Concluir

- Apresentar achados antes do resumo.
- Informar explicitamente quando nenhum achado relevante for encontrado.
- Registrar lacunas de validação, testes não executados e contexto ausente.
- Distinguir recomendação opcional de correção necessária.
- Em refatoração executada, usar o mesmo checklist no diff final e remover alterações que não paguem seu risco.
