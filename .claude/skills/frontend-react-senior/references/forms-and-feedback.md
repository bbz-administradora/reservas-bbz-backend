# Formulários, validação e feedback

## Conteúdo

- [Contrato obrigatório](#contrato-obrigatório)
- [Modelar validação](#modelar-validação)
- [Aplicar máscaras](#aplicar-máscaras)
- [Exibir erro acessível](#exibir-erro-acessível)
- [Mostrar loading e resultado](#mostrar-loading-e-resultado)
- [Gate de revisão](#gate-de-revisão)

## Contrato obrigatório

Todo formulário deve:

- identificar campos obrigatórios e regras condicionais;
- validar obrigatoriedade, formato, limites e relações entre campos;
- usar schema Zod integrado ao React Hook Form como contrato do cliente;
- validar novamente no backend ou banco toda regra de segurança e integridade;
- preservar os valores digitados quando a submissão falhar;
- impedir submissões duplicadas enquanto a ação estiver pendente;
- mostrar loading no botão de submit;
- apresentar erros junto dos campos e focar o primeiro inválido após tentativa de envio;
- exibir toast de sucesso ou falha ao concluir uma ação assíncrona.

## Modelar validação

Distinguir:

- **obrigatoriedade:** valor ausente, vazio ou composto apenas por espaços;
- **formato:** telefone, e-mail, CPF, CNPJ, CEP, data, moeda ou identificador;
- **domínio:** faixa permitida, data futura, combinação de campos ou regra condicional;
- **remota:** unicidade, existência, permissão ou estado atual do recurso.

Normalizar texto antes de validar quando a regra permitir, por exemplo remover espaços externos. Não corrigir silenciosamente um valor quando isso puder mudar seu significado.

Executar validação síncrona durante interação conforme a experiência do módulo e sempre validar o formulário completo no submit. Para validação remota, aplicar debounce quando útil, cancelar resposta obsoleta e repetir a verificação autoritativa na submissão.

## Aplicar máscaras

Exibir telefone, CPF, CNPJ, CEP, moeda e outros dados estruturados com máscara que facilite leitura e preenchimento. Manter separados:

- valor de exibição formatado;
- valor canônico normalizado usado na validação, comparação e persistência.

Exemplo: exibir CPF como `123.456.789-00` e persistir conforme o contrato do domínio, normalmente somente dígitos. Confirmar o contrato existente antes de mudar o formato armazenado.

Criar funções puras e reutilizáveis por conceito, como `formatCpf`, `formatCnpj`, `formatPhone` e suas normalizações correspondentes. Colocá-las no domínio adequado ou em utilitário compartilhado quando houver consumidores reais. Não criar uma única função genérica com muitos modos e condicionais.

Toda máscara deve:

- aceitar entrada parcial sem impedir a digitação;
- permitir apagar, selecionar e colar conteúdo;
- preservar o cursor de modo previsível;
- funcionar em teclado móvel com `inputMode` apropriado;
- respeitar comprimento e variações válidas do domínio;
- possuir testes para vazio, valor parcial, completo, caracteres extras e colagem;
- não ser usada como prova de validade.

Não aplicar máscara destrutiva a campos cujo formato possa variar legitimamente sem conhecer o domínio, como telefones internacionais.

## Exibir erro acessível

Ao detectar erro de campo:

- aplicar o estado visual destrutivo do Design System, normalmente borda ou destaque vermelho;
- não depender somente da cor;
- marcar o controle com `aria-invalid="true"`;
- associar o texto do erro por `aria-describedby`;
- mostrar mensagem curta que explique o problema e, quando útil, o formato esperado;
- manter label e valor digitado visíveis;
- focar o primeiro campo inválido após submissão.

Preferir “Informe um CPF com 11 dígitos” a “Valor inválido”. Não mostrar um toast para cada campo inválido. Erros de validação pertencem ao campo; um resumo no topo pode complementar formulários longos.

Exibir validação sem punir a digitação: evitar erro agressivo antes de o usuário interagir, salvo restrição que precise impedir entrada imediatamente. Usar `touched`, tentativa de submit ou momento equivalente do formulário.

## Mostrar loading e resultado

Enquanto a submissão estiver pendente:

- mostrar spinner no botão de submit;
- trocar o texto por verbo de progresso, como “Salvando...”;
- manter dimensões do botão estáveis;
- desabilitar novo submit quando a operação não puder ser repetida;
- usar `aria-busy` na região ou controle apropriado;
- não limpar campos nem fechar a interface antes de confirmação, salvo optimistic update com rollback definido.

Usar o estado autoritativo da submissão ou mutação, sem criar booleano paralelo que possa divergir.

Após a ação:

- exibir toast de sucesso com resultado objetivo;
- exibir toast de falha com mensagem acionável e preservar o formulário para correção ou retry;
- evitar toast duplicado no hook e no componente;
- não usar toast como único feedback quando a mudança precisa permanecer visível na tela;
- mover foco apenas quando necessário para recuperação, confirmação ou navegação.

Mensagens devem seguir o padrão visual e textual do projeto, no idioma da interface, sem expor erro técnico ou dado sensível.

## Gate de revisão

- Campos obrigatórios e regras condicionais estão explícitos no schema?
- O schema corresponde ao payload enviado?
- Máscara, normalização e persistência possuem contratos distintos?
- CPF, CNPJ, telefone e outros formatos complexos usam funções reutilizáveis e testadas?
- Colagem, valor parcial, teclado móvel e cursor permanecem utilizáveis?
- Todo erro possui destaque visual, texto explicativo e associação acessível?
- O primeiro inválido recebe foco após submit?
- O botão mostra loading e impede duplicidade?
- Falha preserva os dados e permite recuperação?
- Toast de sucesso/falha aparece uma única vez no owner correto?
- Backend ou banco revalida regras que protegem integridade ou segurança?
