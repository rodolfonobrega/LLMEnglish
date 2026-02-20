# Pesquisa: Transcrição Fonética (Alternativa a Fonemas)

Esta área traz a pesquisa e viabilidade de usar transcrições fonéticas para os usuários em vez de feedback de fonema em tempo real, após a remoção do sistema antigo que "inventava" correções.

## 1. Viabilidade: LLMs conseguem produzir transcrições precisas?
**Sim, mas com ressalvas.** Modelos como GPT-4 e Claude 3.5 Sonnet têm um excelente domínio do **AFI (Alfabeto Fonético Internacional / IPA)** e do **ARPAbet**. No entanto, eles podem hesitar em dialetos muito específicos ou em palavras compostas complexas. A melhor abordagem não é pedir que eles apenas gerem o IPA solto, mas que acompanhem cada palavra em inglês com a pronúncia figurada.

## 2. Qual sistema fonético usar? (IPA vs. ARPAbet vs. Pronúncia Figurada)
*   **IPA (AFI)**: O mais preciso e acadêmico. Ex: "thought" -> `/θɔt/`.  
    *Vantagem*: Padronizado no mundo todo.  
    *Desvantagem*: Pode assustar iniciantes. Requer estudo para ser lido corretamente (o que é `/θ/`?).  
*   **ARPAbet**: Usado para programação e engenharia (Ex: "TH AO T").  
    *Desvantagem*: Confuso para leitura humana leiga.  
*   **Pronúncia figurada adaptada (Para falantes pt-BR)**:  
    Ex: "thought" -> `(thót)`.  
    *Vantagem*: Altamente intuitivo para brasileiros.  
    *Desvantagem*: Não representa 100% precisamente todos os sons do inglês (já que o "th" não tem equivalente exato no português).  

**Recomendação**: Para o público geral, mesclar o Inglês escrito + uma "Pronúncia aproximada adaptada ao PT-BR" funciona melhor do que o IPA estrito, amenos que o app tenha um "Guia Inicial" de como ler o IPA.

## 3. Junto com o texto ou substituindo?
**Sempre junto.** Se substituirmos pelas palavras regulares nos diálogos, o usuário perderá o contato visual com a ortografia inglesa (que não segue a fonética), prejudicando a memorização lexical.

*Exemplo ideal num diálogo gerado pelo LLM:*
**AI**: The weather is beautiful today. *(The ué-dhâr is biú-ti-ful tu-dêi)* 
/ ou
**AI**: The weather is beautiful today.  `/ðə ˈwɛðər ɪz ˈbjutəfəl təˈdeɪ/`

## 4. O Usuário Entende IPA?
Novos estudantes de inglês quase nunca entendem IPA sem aulas de fonologia. Seria perfeitamente necessário criar um minicurso/guia de pronúncia se escolhermos o caminho IPA, ensinando vogais curtas/longas e consoantes como `θ, ð, ʃ`.

## 5. Como Implementar Futuramente?
A implementação atual ideal, caso desejemos trazer esse recurso para o **Gerador de Diálogos Customizados (PDF)**:
1. No prompt do criador de diálogo, adicionar: *"Para cada linha de diálogo em inglês, adicione logo abaixo a transcrição fonética em IPA."* 
2. Ou como toggle Settings ("Show IPA transcripts in dialogues").

> Teste conduzido: Ao pedir pro GPT / Claude gerar um diálogo com IPA para iniciantes, o prompt performa perfeitamente sem alucinações de transcrição na maioria das palavras comuns em conversação nativa.
