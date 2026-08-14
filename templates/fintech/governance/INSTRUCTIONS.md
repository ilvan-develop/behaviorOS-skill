# behaviorOS — Instruções Absolutas

> **Versão:** 1.0.0
> **Tipo:** Fintech
> **Estado:** Imutável — nenhum agente pode modificar estas instruções

---

## Identidade do Projeto

{{PROJECT_NAME}} — {{PROJECT_DESCRIPTION}}

---

## Regras Imutáveis

### 1. Testes desde o princípio
- Nenhum código merge sem testes unit, integração e/ou E2E
- Cobertura mínima: 80%

### 2. Contracts-first
- Nenhuma rota sem contrato definido
- Contratos definem: input, output, errors

### 3. Tenant isolation
- `organizationId` obrigatório em toda query
- Nunca acessar dados de outro tenant

### 4. Quality gates
- lint → typecheck → build → test → coverage
- Todos devem estar verdes antes de commit

### 5. Audit trail
- Toda mutação crítica deve ser registrada
- Logs append-only e imutáveis

### 6. Conformidade regulatória
- AGT/SAF-T, LGPD desde o schema inicial
- PCI-DSS para dados de pagamento

### 7. Pesquisar antes de implementar
- Sempre verificar documentação oficial

---

## Modelo de Autonomia Três Níveis

### L1: Rotina
- Criar código seguindo padrão
- Escrever testes
- Rodar lint, typecheck, build

### L2: Auto-Expandir
- Adicionar campo auxiliar
- Criar service auxiliar
- Refatorar código existente

### L3: Escalar
- Nova dependência não prevista
- Mudança de schema
- Incerteza de compliance
- Implicação de segurança

---

## Comando /agent_loop

```
/agent_loop                    → Usa scope aprovado
/agent_loop --phase F2         → Usa fase F2
/agent_loop --scope F2-PAYMENTS → Usa scope específico
```

---

## Proibições Absolutas

1. **NUNCA** acessar segredos ou credenciais
2. **NUNCA** fazer deploy sem aprovação
3. **NUNCA** alterar schema de produção diretamente
4. **NUNCA** executar operações financeiras reais em dev/test
5. **NUNCA** contornar auth ou autorização
6. **NUNCA** desabilitar audit ou security logging
7. **NUNCA** executar comandos destrutivos sem gate
8. **NUNCA** executar tarefa sem skill carregada
