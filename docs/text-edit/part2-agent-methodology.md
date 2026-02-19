# Part 2: Agent Methodology

All body text from the Agent Methodology section (MethodologySection.tsx). Edit freely — text will be swapped back into the codebase.

---

## MAIN HEADER

### Tag
$ cat methodology.md

### Title
HOW THE DATA WAS BUILT

### Subtitle
Seven autonomous AI agents cataloged 37 years of Architectural Digest and cross-referenced every name against the Epstein records...no human touched the data.

---

## ABSTRACT (1-column layout)

### Overview

**Overview**
AI is a tool, and it is important that our tools not shape our world, but rather help us undertand it. 

### ABSTRACT PARAGRAGH 1
This project began with a simple enough question: "How many of the of the high-profile people gracing the glossy pages of Architectural Digest are also named in the xeroxed, Justice-Department-cataloged, unredacted public records of Jeffrey Epstein's social network?"

### ABSTRACT PARAGRAGH 2
What started as curiosity and pecking around via a manual process of looking up old issues very quickly snowballed into a major logistical nightmare. Going line by line and entering the name into the DOJ website, reading every pdf that came up, then trying to cross off and remember each name in a spreadsheet file somewhere: "Did I look at that one already?" "Which issue did I check yesterday?" It's been 38 years since Jeffrey Epstein started his eponymous financial management firm, J. Epstein & Company.^1 In that time, AD has published over 1,300 issues. With an average of four features per issue, that is over 4,000 homes, the vast majority of them having named homeowners. It was clear that undertaking something like this manually would be measured not in days or even months, but in such an inordinate amount of time that it wasn't even worth attempting to quantify.

### ABSTRACT PARAGRAGH 2
That realization led to a pivot: less “must use AI,” and more “what is the system design architecture” that could fundamentally accelerate this process. I'm not a software engineer; but I was a researcher breaking the work into repeatable tasks—extract the name, query the record, evaluate the match, log the evidence—steps that could be handed off to a program if they could be articulated and clearly defined. Once the problem became architectural, the scope expanded.

### ABSTRACT PARAGRAGH 3
Again, AI is a tool. And a tool was needed to technically answer important questions that would otherwise be too impractical to ask, at scale, and at great speed. It's not feasible by a single researcher. Yet that doesn't make AI smarter than the researcher. It makes the researcher capable of asking bigger questions. In fact, that is what happened, as you can see if you take a look at the "Aesthetic Methodology" section. Working through the technical challenges of making this work, I experienced firsthand what is challenging with "vibe coding", what's actually, you know, pretty amazing, and what at first blush seemed like it should be really easy but actually took hours of frustrating detail to get right, all enhanced my creativity. I questioned some of my initial assumptions, thought deeper about "how" data flows through a pipeline, and moved in scale and scope that I didn't think possible before I started. 

### ABSTRACT PARAGRAGH 4
What follows is a detailed account of this modular, multi-agent workflow that processes document corpora, extracts structured entities, cross-references them against external records, investigates flagged matches, and produces an auditable trail of documentation for every conclusion. This specific case study here concerns a design magazine and a global criminal network. But structurally, the system could be aimed at campaign finance records, nonprofit boards, corporate directorships, university trustees, and cultural institutions gala attendees. That initial question can change; the pipeline remains. 

### ABSTRACT PARAGRAGH 5
This document explains how that pipeline works, where it succeeds, where it fails, and where the borders between human judgment and machine autonomy are still being drawn. 

**Research Questions**
The primary technical question was straightforward:

### RESEARCH QUESTION PARAGRAPH 1
Can an autonomous AI pipeline read, interpret, and evaluate thousands of documents with enough semantic and contextual understanding to make rapid, defensible investigative judgements at scale, while preserving a transparent, auditable chain of reasoning?

### RESEARCH QUESTION PARAGRAPH 2
From that flowed more difficult design problems:
* How do you decompose an open-ended investigation into discrete stages with clean handoffs?
* How do you build an autonomous system, without a human in the loop, that handles ambiguity in names responsibly and avoids false positives?
* How do you encode evidentiary standards so the system distinguishes coincidence from confirmation?
* What infrastructure do agents need beyond a system prompt (things like memory, communication, reflection) to sustain quality over thousands of sequential decisions?

### RESEARCH QUESTION PARAGRAPH 3
The following sections describe an attempt to answer those questions:

**Section 1: The Pipeline** 
The system operates as a five-stage sequential pipeline: data acquisition, feature extraction, cross-referencing, investigation, and editorial review. Each stage has a defined input, a defined output, and a specialized agent responsible for the work. A magazine issue enters the pipeline as a URL and exits as a set of structured features, each with a homeowner name, designer, location, aesthetic profile, and a confirmed or rejected Epstein cross-reference with a full evidentiary trail.

### OVERVIEW SECTION PARAGRAPH 1
Each agent follows what the research literature calls the ReAct pattern: interleaving reasoning ("this Black Book match is surname-only, probably a coincidence") with actions (search the DOJ library, query the knowledge graph), observing the results, and reasoning again.² This Thought → Action → Observation loop is now the foundational architecture behind most LLM agent systems, and every agent in this pipeline implements a version of it.

### OVERVIEW SECTION PARAGRAPH 2
The pipeline processed the entire run of 1,396 magazines and 4,081 features. It is now primed and ready to process future issues in perpetuity. 

**Section 2: Multi-Agent Architecture** 
As convenient as it would be to have a one-shot system capable producing results with the single prompt: "Give me all of the names that appear in both Architectural Digest and the Epstein Files", this system used seven specialized agents coordinated through a central "Editor." This hub-and-spoke architecture was built piece-by-piece and is a deliberate design choice: it prevents contradictory updates, ensures a single auditable decision trail, and makes it possible to swap out any agent without affecting the others.

### OVERVIEW SECTION PARAGRAPH 3
Different model tiers are used for different stakes: faster models for routine routing, more capable models for high-consequence evaluation. This reduces cost while preserving review quality. Each agent shares the same underlying model (Claude) but receives entirely different instructions, evidence standards, and decision rules. This section details the architecture, the message-passing protocol, and the retry logic that keeps the system running when individual agents fail.

**Section 3: Personality as Architecture** 
Why do these autonomous AI agents have names, archetypes, and voices? Does it matter? The short answer is: it depends on the task, and the academic literature is genuinely split.

### OVERVIEW SECTION PARAGRAPH 4
Most of the investigative decisions included here are not binary lookups. They are judgment calls. Actually, most of them are  judgement calls requiring reasoning and an understanding of conversational context and semantic meaning. For these types of descision, carefully designed personas measurably shift behavior in useful ways. When the Detective personality is "terse and skeptical," we were really making an engineering decision about false-positive tolerance. When the Editor is "demanding and autocratic," we were tuning the editorial review threshold. The character design process forced a deeper thinking about what each stage should optimize for. This section unpacks the three layers that constitute how the agent personas affect their tasks: the system prompt as agent identity, why character outperforms rulebook for judgment tasks, and what's genuinely technical versus what's creative expression.

**Section 4: Investigation Methodology** 
Clint Eastwood's Carmel home was featured in Architectural Digest. "Clint Eastwood" also shows up in the Epstein files. His name is listed in an advertisement in the sidebar of a movie ticket Epstein purchased at AMC Theaters. Clint Eastwood the actor is not in the Epstein files. Can an AI differentiate between what is genuine and what is digital noise? Another case: Epstein's PR publicist asks him if he would like to meet a famous actress, yet there is no record of them actually meeting. Are they connected? And another case: a wealthy businessman is on an "confirmed to attend" a dinner event at Epstein's mansion, but there is no follow up. Is that a connection? Can we quantify what is a legitimate connection and what is coincidence? 

### OVERVIEW SECTION PARAGRAPH 5
The agent does not guess from memory. It retrieves specific documents and reasons over them in context. Each dossier records what was consulted and why the conclusion followed. The investigation stage is the most sensitive part of the system. When a name is flagged as a possible match, the Researcher agent performs a structured sequence:
	1.	Triage assessment
	2.	Document retrieval from DOJ archives and the contact book
	3.	Knowledge graph queries mapping network connections
	4.	Evidence synthesis
	5.	Verdict with explicit justification
Each step builds on the previous on, a structured reasoning chain, an approach that research has shown dramatically improves model performance on complex tasks compared to direct question-answering.³

### OVERVIEW SECTION PARAGRAPH 6
You can view all of those dossiers here: https://www.wheretheylive.world/fullindex?page=3#index

### OVERVIEW SECTION PARAGRAPH 7
At its core, the investigation is a retrieval-augmented process: the agent retrieves relevant documents (Black Book entries, DOJ search results, graph query outputs) and reasons over them in context. This combinines a language model's reasoning with retrieved external knowledge, a pattern that has become foundational to knowledge-intensive AI applications.⁴ The critical addition in this pipeline is that the Researcher doesn't just retrieve and summarize, she actually evaluates. Each dossier is functionally a judicial verdict, and research on using language models as evaluative judges has shown they can achieve over 80 percent agreement with human judgment, while also exhibiting systematic biases (position bias, verbosity bias, self-enhancement) that must be designed around.⁵

### OVERVIEW SECTION PARAGRAPH 8
Even so, default model judgment was insufficient in edge cases. Explicit policy rules were required: what qualifies as “confirmed,” what qualifies as “associated,” and what must be rejected. These standards were refined through adversarial testing (intentionally searching for cases that would trick the system and the human providing definitive responses).

### OVERVIEW SECTION PARAGRAPH 9
This section details those evidence standards, the explicit policy rules, and the adversarial testing that refined them. We walk through real case studies: a name that appeared in both the Black Book and DOJ files but was correctly rejected as a different person, and a name that was initially missed but caught on manual review.

**Section 5: Intelligence Infrastructure** 
Behind the agents sits a shared infrastructure that enables "learning" and coordination:
*  A knowledge graph that stores all of the extracted names, locations, styles, and other metrics, and maps all of those connections as a searchable network.
* Episodic memory allows agents to recall prior decisions
* Reflection loops where the Editor reviews patterns in past outcomes

### OVERVIEW SECTION PARAGRAPH 10
The knowledge graph is particularly important. It transforms isolated document hits into a relational network that can answer structural questions: which designers appear repeatedly? Which locations cluster? Which individuals bridge otherwise separate communities? The researcher uses this when building a dossier. 

### OVERVIEW SECTION PARAGRAPH 11
You can view the full knowledge graph of connections here: https://www.wheretheylive.world/fullgraph

### OVERVIEW SECTION PARAGRAPH 12
This is where the methodology becomes portable. Any domain involving people, institutions, and documents can be modeled as a graph. Once structured, it becomes queryable.

**Section 6: UI Interface and Transparency** 
In many ways an AI system is a black box. A prompt goes in, and an answer appears. What happens in between is invisible. For a project like this, a simple textual back and forth on a terminal command line becomes challenging. With so many moving pieces you lose sight of the overall big picture. You would have to constantly be spamming the terminal line: "How far along are we?" "What is the Detective working on?" "How many issues have been extracted?" "What is this costing in tokens overall?" "How long has the Courier been error'ed out?" There is too much to keep track of. 

### OVERVIEW SECTION PARAGRAPH 13
You could keep it a black box. For many problems I would think that that would actually be preferable, just provide prompts in the text box and let the program work behind the scenes. For others though, maybe you do need it to look like the cockpit of a 787, complete with dials and knobs that you're constantly tweaking to zero in on a creative solution. There is no consistent UI design that could be applied to all AI workflows. It's an interesting concept with far reaching implications. Can you build a frontend UI on the fly that responds to your unique, individual problem? Can you spin up a new UI that changes instantly with new tools? Now, the design goals shape the software tools. 

### OVERVIEW SECTION PARAGRAPH 14
It was important that the system working could be inspected in real-time and that all of the results could be viewed by anyone. The UI Dashboard allowed me to monitor the pipeline state as it progressed, but most importantly, allowed me to make decisions and pivot to new expanded creative directions as information flowed in. Ultimately, two front-ends were built:
* An internal dashboard monitoring pipeline state, cost, throughput, and error rates
* A public-facing site where every feature and every verdict can be browsed

### OVERVIEW SECTION PARAGRAPH 15
This section covers the design decisions behind both the frontend "office" UI and the workflow for creating an interactive searchable index of all 4,081 features with individual dossier pages that present evidence in a structured, readable format.

**Section 7: Key Challenges and Limitations** 
No system built on language-models is immune to failure.

### OVERVIEW SECTION PARAGRAPH 16
The largest source of false positives was surname collisions: dozens of apparent matches that dissolved under closer inspection. Automated browsing of DOJ records required workarounds due to bot-detection systems. Hundreds of magazine features lacked named homeowners, limiting cross-referencing.

### OVERVIEW SECTION PARAGRAPH 17
Most importantly, calibrating autonomy remains an open problem. Approximately 20% of confirmed cases are deliberately routed for manual review. The system is designed to recognize uncertainty and defer rather than guess. However, I thnk that this demonstrates the value of human-in-the-loop decision making and reinforces the role of machine automation and human judgement. 

**Section 8: Data Sources** 
Every system starts with data. Is it available or do we need to create it? Is it enough? This pipeline draws on three primary data sources, each with different access methods, reliability characteristics, and limitations. The Condé Nast digital archive provides structured article metadata via JWT-encoded payloads and public page images via Azure Blob Storage. Epstein's Little Black Book is a static text file searched locally with regex word-boundary matching. The DOJ Epstein document library is a browser-automated search against an Optical Character Recognition (OCR)-indexed database of tens of thousands of scanned documents. It's powerful but limited by OCR quality (handwritten documents aren't searchable) and the DOJ's bot-detection infrastructure. In this section, we document each source, its coverage, and its known gaps.

**Section 9: Conclusions and Future Work** 
The pipeline as built is a working proof of concept: seven agents, operating autonomously, processed 37 years of a single magazine and produced a structured, auditable dataset of cross-referenced findings. The methodology is reproducible and the code is documented. As a non-software engineer, it's important to also be clear about what the system is and what it isn't. This is a scalable investigative tool that handles routine cross-referencing at a throughput no human could match. It is not a replacement for human judgement, but it could be described as a force multiplier for it. 

### OVERVIEW SECTION PARAGRAPH 18
For next steps, two extensions are in progress:
* Extending the Researcher's ability to dynamically query the knowledge graph for more flexible evidence gathering
* An aesthetic signature analysis that derives a nine-axis scoring criteria to statistically test whether Epstein-connected homes exhibit a distinguishable design profile compared to the AD baseline. This will use established methods from multivariate statistics to a novel domain. See the following section "Aesthetic Methodology."



### FOOTNOTES
1. Stewart, James B.; Goldstein, Matthew; Kelly, Kate; Enrich, David (July 10, 2019). "Jeffrey Epstein's Fortune May Be More Illusion Than Fact". The New York Times. ISSN 0362-4331. Archived from the original on July 11, 2019. Retrieved July 11, 2019.


2 Yao, S. et al. (2023). "ReAct: Synergizing Reasoning and Acting in Language Models," ICLR 2023. The foundational paper for the Thought → Action → Observation loop now standard in LLM agent systems. https://arxiv.org/abs/2210.03629

3 Wei, J. et al. (2022). "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models," NeurIPS 2022. Demonstrated that structuring model reasoning as explicit step-by-step chains dramatically improves performance on complex tasks. https://arxiv.org/abs/2201.11903

4 Lewis, P. et al. (2020). "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," NeurIPS 2020. Formalized the pattern of combining language model reasoning with retrieved external documents. https://arxiv.org/abs/2005.11401

5 Zheng, L. et al. (2023). "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena," NeurIPS 2023. Found >80% agreement between LLM judges and human preferences, while identifying systematic biases that must be designed around. https://arxiv.org/abs/2306.05685


**METHODOLOGY**
A hub-and-spoke multi-agent system with seven specialized AI agents, coordinated by an editor agent, operating across three phases: corpus building, cross-referencing, and editorial review.

### Column 2

**SYSTEM ARCHITECTURE**
Seven specialized agents in a hub-and-spoke topology: Scout discovers issues, Courier downloads content, Reader extracts features, Detective cross-references names, Researcher builds dossiers, Editor renders final verdicts, and Designer builds the interface.

**KEY CHALLENGES**
Name disambiguation across two large corpora, OCR limitations in handwritten DOJ documents, and maintaining a 93% rejection rate for false positives while minimizing false negatives.

### Column 3

**PRINCIPAL FINDINGS**
33 confirmed connections identified from approximately 2,180 cataloged features across 480 issues. The confirmed population clusters in specific decades (1997–2003), geographies (Northeast corridor, Southern California), and aesthetic traditions (classical European grandeur).

**FUTURE WORK**
Extending the methodology to additional shelter magazines (Vogue Living, World of Interiors, Elle Decor), validating aesthetic taxonomy against human expert panels, and analyzing the temporal dynamics of social proximity to Epstein across the full magazine timeline.

---








## SECTION 1: THE PIPELINE

### Subtitle
How a magazine URL becomes a confirmed or rejected connection with a full evidentiary trail

### Body Paragraph 1
The system operates as a six-stage sequential pipeline: data acquisition, feature extraction, cross-referencing, investigation, editorial review, and then report design. Each of these stages has a clearly defined input, a defined output, and a dedicated agent responsible for the work. A magazine issue enters the pipeline as a URL and exits as structured records, each containing a homeowner name, designer, location, aesthetic profile, and—if the name was flagged—a confirmed or rejected cross-reference with a full evidentiary trail. 

### Body Paragraph 2
Here's what that actually looks like in practice. The AD Archive (https://archive.architecturaldigest.com/) contains a structured digital version of every issue published. There are other—more challenging, less structured—data sources available: PDFs with incorrect metadata on archive.org, issue scans on random personal websites, some digital features on the main site, eBay back issues, but none of them had what became a gold-standard source of machine readable metadata. Each issue page embeds a JWT-encoded article catalog, a structured JSON object containing the title, teaser, designer credit, and page range for every feature. As a brief aside, some of those articles cataloged as "features" actually weren't a true feature, they were more like roundups of a flahy locations or a focus on one specific architect's work. A review by Haiku AI quickly separated legitimate features from non-features. 

### Body Paragraph 3
The AD archive issue data made this process smoother than expected. In Stage 1, a Scout agent discovered the issue URL. A Courier agent fetches the page, decodes the JWT, and downloads the corresponding article page images from the publisher's content delivery network. No PDF cracking, no OCR. The structured metadata is already there, embedded in the page itself. A Reader agent was originally designed to "read" or extract data from scanned PDFs, but this process proved cumbersome and ultimately unnecessary after discovering the embedded metadata source. 

### Body Paragraph 4
In Stage 2, those page images go into an extraction model. Claude Opus examines each set of article pages and extracts the homeowner's name, their designer, the city and country, the architectural style, the article's author, and nine aesthetic scores via a custom scoring instrument developed for this work (more on that in the Aesthetic Methodology section). Let's take an example from the July 1996 AD issue: one of the extracted features showcases the unambiguously lavish, triplex penthouse on the Upper East Side of Manhattan, designed for media mogul Mort Zuckerman, owner of U.S. News & World Report and the New York Daily News. 

### Body Paragraph 5
In Stage 3, the name "Mort Zuckerman" reaches the Detective's inbox. There, he runs two checks in rapid succession. First, an instant search of Jeffrey Epstein's Little Black Book—a 95-page contact directory seized during the original 2008 investigation. The Black Book contains a "Zuckerman, Mort" entry with phone numbers. That alone constitutes a direct match: Epstein had this person's contact information in his personal address book. Second, the Detective queries the DOJ's Full Epstein Library—a public search interface that spans across millions of pages of unredacted documents. The result of that DOJ search: 1,317 documents containing "Mort Zuckerman." The Detective's verdict: confirmed via presence in the Black Book and extensive documented DOJ references. 

### Body Paragraph 6
Stage 4 shifts the system from identification to investigation. The Researcher receives the Detective's verdict and the raw evidence and begins the work of constructing a dossier. She queries the DOJ documents for specifics: What was the nature of the documents in the DOJ files? It included scheduled meetings at Epstein's East 71st Street address, coordinated via Lesley Groff—Epstein's chief scheduler (Groff was subpoenaed in 2019, but prosecutors declined to bring charges). The Epstein <> Zuckerman relationship persisted from at least 2010 through 2014—many years after Epstein's 2008 criminal conviction. The Researcher cross-references the knowledge graph and finds that Zuckerman's AD feature documents a friendship with Henry Kissinger, himself another confirmed Epstein associate. She compiles every document reference and finding into a structured dossier. 

### (make this a sidenote) That dossier lives here: https://www.wheretheylive.world/report/4873

### Body Paragraph 7
Next, in Stage 5, that dossier reaches the Editor for final review. The Editor is the only agent that can write a verdict to the database. She examines the total evidence chain: Black Book entry (direct contact), 1,317 DOJ references (sustained relationship), scheduled meetings at a private residence (not a public event), post-conviction contact (the relationship survived legal disgrace). Clear cut, a confirmed connection with high confidence. The feature, the cross-reference, the dossier, and the verdict are all written to the database as a single auditable record. 

### Body Paragraph 8
Now consider a false positive. The system checks every name, including "Francis Ford Coppola," who was featured in a September 1995 issue where the director shared his jungle retreat in Belize with AD. The DOJ library *does* return results for "Coppola." However, by reading the context of the individual pdfs, the Detective understands that this is actually Donato Coppola excitedly reaching out to Jeffrey Epstein to set up a meeting. And then there is also Scott Coppola, who was shown emailing Jeffrey Epstein's girlfriend Karina Shuliak in a Facebook message in 2011 (make this a sidenote: https://www.justice.gov/epstein/files/DataSet%209/EFTA00575663.pdf). Same last name, but very different people. The Detective's verdict: no match. The pipeline flags the name, investigates it with the same rigor, and moves on. No human had to intervene to catch the false positive. The system's evidence standards caught it automatically, while a careless system would have stopped at the surname.

### Body Paragraph 9
In Stage 6, the Designer synthesizes the pipeline’s output into a visual report for every home in the archive, not only those with confirmed connections. Each feature receives a dedicated detail page pairing article imagery with structured data, including nine aesthetic scores plotted on a radar chart. The decision to measure nine axes rather than six, to organize them into clusters—Space, Story, and Stage—and to introduce a “hospitality” dimension distinguishing private retreat from social venue was driven by the analytical need to test divergence from the broader baseline. Presentation and measurement were developed in tandem. The report design pulled the data collection method upstream. How the findings are presented and what was measured are indivisible. 

### Body Paragraph 10
Separating each of the agents concerns means that an error in extraction doesn't corrupt the cross-reference, a false positive in the Detective stage doesn't bypass the Editor's review, and every stage produces an intermediate output that can be independently audited. If someone questions a particular finding, you can trace the exact path: here's the page the name was extracted from, here's the Black Book entry, here are the DOJ documents, here's the Researcher's analysis, here's the Editor's reasoning. The pipeline doesn't just produce a black-box conclusion, it produces detailed evidence for those conclusions. 


### Body Paragraph 11
This is what the literature calls the ReAct pattern: interleaving reasoning ("this Black Book match is surname-only — probably a coincidence") with actions (search the DOJ library, query the knowledge graph), observing the results, and reasoning again. This loop underlies most modern LLM agent systems, and every agent in this pipeline implements a version of it. The Detective doesn't just pattern-match a name against a database. It reasons about the quality of the match, decides what additional evidence to seek, evaluates what it finds, and produces a verdict with its reasoning attached.

### Body Paragraph 12
It is important to resist the illusion of infallibility. The DOJ search interface is OCR-based, which means handwritten documents — and there are many in the Epstein archive — are effectively invisible to the system. Name matching always carries edge cases: “Ashley” could refer to Ashley Hicks (confirmed in the Black Book with a London address) or Sir Bernard Ashley (the Laura Ashley co-founder, featured in AD, with no documented Epstein connection). Many features from the 1980s and early 1990s do not name homeowners at all, and no amount of computer vision can extract a name that was never printed on the page. The pipeline is also constrained by the documents it can access: if a relationship was never recorded, remains redacted, or has not been released, this system will never discover it.


### Body Paragraph 13
But what it can do is reliably transform ambiguity into structured, reviewable decisions at a scale no individual researcher could sustain alone. This same pipeline, pointed at a different data set, would run the same way. The question may change but the architecture stays the same. 



### Phase Cards

**Phase 1: BUILD THE AD DATABASE**
Scout discovers issues on Archive.org. Courier downloads and extracts article catalogs. Reader processes page images to extract homeowners, designers, locations, and styles.
Agents: Scout → Courier → Reader

**Phase 2: CROSS-REFERENCE EPSTEIN RECORDS**
Detective cross-references every name against the DOJ Epstein Library and the Little Black Book. Researcher builds dossiers on every lead that passes initial screening.
Agents: Detective → Researcher

**Phase 3: REVIEW & VISUALIZE**
Editor renders binary verdicts on every dossier. Designer builds the public interface. All confirmed connections are independently verifiable against primary sources.
Agents: Editor → Designer

### Pipeline Stats
- AGENTS: 7
- AI MODELS: 4
- DATABASES: 3
- YEARS: 37
- API COST: ~$55
- TOTAL RUNTIME: ~18h

---

## SECTION 2: MULTI-AGENT SYSTEM

### Title
MULTI-AGENT SYSTEM

### Subtitle
Seven specialized agents in a hub-and-spoke topology.

### Intro Paragraph 1
The system uses a hub-and-spoke architecture with Miranda, the Editor agent, as the central coordinator. Miranda assigns tasks to specialized agents through asyncio queues, monitors progress, and renders final editorial verdicts. Each agent operates autonomously within its domain — the Detective doesn't wait for the Researcher, and the Researcher doesn't wait for the Editor — but all report results back to the hub.

### Intro Paragraph 2
This architecture was chosen over alternatives (pipeline chain, peer-to-peer mesh, blackboard) because the investigation has a natural editorial hierarchy. Not all agents are equal: the Editor's verdicts override the Detective's assessments, and the Researcher's dossiers can be sent back for revision. Hub-and-spoke encodes this asymmetry in the system topology.

### Intro Paragraph 3
The seven agents run concurrently, each processing its own queue. When the Scout discovers a new issue, the Courier is already downloading the previous one, the Reader is extracting features from the one before that, and the Detective is cross-referencing names from even earlier. The pipeline is never idle — there is always work moving through the system.

### Summary
Miranda reviews every dossier personally — no confirmed connection reaches the public index without editorial sign-off. The other six agents work concurrently, each processing its own queue.

---

## SECTION 3: PERSONALITY AS ARCHITECTURE

### Subtitle
Why do these autonomous AI agents have names, archetypes, and voices? Does it matter?

### Body Paragraph 1
If we want to dig into this question, there are actually three layers to uncover. It's worth it to take a minute to unpack each because it speaks to the nature of how the agentic system works.

**Layer 1: The System Prompt IS the Agent**
When you call an AI model in something like Claude, you are sending it a system prompt. That's just a set of instructions that tells it how to behave. Example: "You are a research assistant. Read the following text, do a thorough academic code review, and add footnotes where applicable. Be thorough and precise." In turn, every response the model produces is shaped by that simple prompt. 

### Body Paragraph 2
An "agent" in this pipeline is, at its core, just a system prompt plus a task queue. Silas the Detective doesn't exist somewhere as a separate piece of software. He's a set of instructions that get sent to Claude every time we need a given name checked against the Epstein records. Elena the Researcher is a whole different set of instructions sent to the same model, but for a different kind of task. 

### Body Paragraph 3
So, when we say: "the Detective checks a name," what's actually happening is:
1. The orchestrator pulls a homeowner's name from the queue
2. It sends that name to Claude along with Silas' system prompt, that includes his methodology, his evidence standards, his decision rules, etc. 
3. Claude responds as shaped by those instructions. 
4. Those results get written to a central database. 

### Body Paragraph 4
Silas being anthropomorphized as a typical "terse, sardonic, false positives offend him existentially" kind-of-guy is actually not just an added sprinkling of decoration on top of a simple quantitative task. The persona becomes part of his system prompt—his instructions. This personality steers how this agent approaches ambiguous cases. 

**Layer 2: Why a Character Works Better than a Rulebook**
Here's the technical part: Does it matter that the Detective Agent is "Silas, a Sam Spade archetype" rather than just a "cross-referencing machine with 14 clearly codified rules"? 

### Body Paragraph 5
It actually depends on the task, and the academic literature is split. 

### Body Paragraph 6
A 2024 study tested 162 different personas across 2,410 factual questions and found that adding a persona generally does not improve factual accuracy, if anything it's the opposite.^1 If you ask a model "What year was the Treaty of Versailles signed?" it doesn't matter if you've told it to be a plumber or a historian. 

### Body Paragraph 7
A crucial difference is that here our agents aren't answering factual questions. They're making judgment calls: is this a real Epstein connection or just someone with the same last name? Is the interior design of this home more "theatrical" or "restrained"? Those are subjective assessments, and for subjective, domain-specific reasoning, expert personas do shift behavior in measurable ways. When researchers built multi-agent systems where specialized evaluators with distinct personas debated each other's assessments, they achieved around 16% higher correlation with human judgement as opposed to a single agent evaluation. And critically, this improvement disappeared when the persona diversity was removed.^3 The value came specifically from having different agent perspectives shaped by different roles. 

### Body Paragraph 8
When Silas encounters the name "Coppola" that could be "Donato Coppola" obsequiously emailing Jeffrey Epstein back for the chance to meetup (https://www.justice.gov/epstein/files/DataSet%209/EFTA01187523.pdf), or it could be "Francis Ford Coppola" sharing his magnificent retreat in Belize in the September 1995 issue (https://archive.architecturaldigest.com/article/1995/9/francis-ford-coppola-in-belize). The "false positives offend him" framing makes the model more likely to pause and disambiguate rather than rubber stamping "Coppola" as a connection match. It is not purely a binary factual, it's an evidence weighing judgment call, exactly where persona design matters. 

### Body Paragraph 9
A related line of research has shown when multiple specialized personas start to interact—debating, reviewing each other's work, bantering together(?)—the results are significantly better than any single persona working alone.^2 This is closer to what our pipeline is doing: Silas flags a name, Elena investigates it, Miranda reviews both of their work. The value isn't in any one character. It's in the structured disagreement and collaboration between each of them.  

**Layer 3: What's Creative Expression vs Technical Function**
It's helpful to define the difference here:

**Technically Functional:**
* Each agent has their own distinct methodology (Detective checks Black Book + DOJ, Researcher does a multi-step investigation, Editor applies editorial judgement). This is a separation of concerns, a basic software engineering principle applied to AI. Research on autonomous agent pipelines confirms that structured role-based collaboration outperforms single-agent approaches for complex multi-step tasks^4
* Each agent has a personality that matches its task (the Detective is skeptical, the Researcher is thorough, the Editor is demanding). For evaluative tasks such as this one, carefully designed personas shape edge-case behavior, however, the key word is "carfully". Generic or poorly matched personas can hurt more than help.^7
* Using different model tiers for different agents. The Editor uses a more powerful model (Opus) for quality-critical reviews and a faster one (Sonnet) for routine tasks. Research confirms that mixing model capabilities across agents outperforms using the same model everywhere by as much as 47% on certain tasks.^5
* Agents have reflection loops. The Editor periodically reviews her own past decisions and identifies patterns. Multi-agent systems with structured reflection mechanisms that generate targeted feedback for individual agents shows measurable reductions in cascading errors.^6

**Primarily Creative (but Still Valuable!):**
* The specific archetypes (Sam Spade, Miranda Priestly, Andrew Neiman) are memorable shorthands for complex instruction sets. A different set of archetypes with the same underlying instructions would produce similar pipeline results. 
* While the character sprites and backstories, don't fundamentally change the AI's output, they do make the project more human. 
* The in-character conversations where you can talk to Miranda as Miranda works as an interactive developer tool, not a pipeline component. 

### Body Paragraph 10
The real insight is that in many way the technical value isn't in the specific characters, rather, it is in the act of designing them carefully. It's a simple idea, but when we decided Miranda should be demanding and autocratic, we were really making engineering decisions about how strict to dial in the engineering revew. When we made Silas terse and skeptical, we were trying to tune down the false-positive rate as much as possible. The character design process forced a deeper thinking about what each stage of the pipeline should optimize for. The personas therefore act as human-legible encoding of engineering decisions. This can be a valuable lesson as agents become more and more complex and unleased on more complicated problems.  

### Body Paragraph 10
Research backs this up. A 2024 study found that "coarsely aligned" or generic personas often hurt performance, but carefully design, task-specific personas can measurable improve it.^7 In the future, as agentic workflows become more widespread, the quality of the persona design and storytelling could become a primary consideration. 

### Summary
Seven AI agents processed 4,081 magazine features, cross-referenced more than 3,000 names against federal records, investigated over 1,000 leads, and confirmed 100+ connections autonomously. The significance of these results is structural: this was not a manual audit but a reproducible investigative system operating at scale. The outcome did not depend on personas; it depended on architecture—task queues, deterministic database writes, retry logic, and calibrated evidence thresholds that disciplined false positives and defined what qualified as confirmation. The human role was upstream: asking the question, designing the framework, endlessly stress-testing the pipeline, and deploying it publicly on this site. The agents executed judgment, the codebase enforced standards, and the result is not just a set of findings but a scalable, auditable method.

### Footnotes
^1 Zheng et al., "https://aclanthology.org/2024.findings-emnlp.888/," Findings of EMNLP 2024. Tested 162 personas across 2,410 factual questions; persona prompting did not reliably improve correctness.
^2 Wang et al., "https://aclanthology.org/2024.naacl-long.15/," NAACL 2024. Found that simulating collaboration between multiple expert personas effectively reduced hallucinations while maintaining reasoning capabilities — though notably only in GPT-4, not smaller models.
^3 Chan et al., "https://openreview.net/forum?id=FQepisCUWu," ICLR 2024. Demonstrated that specialized evaluator agents with diverse personas, debating sequentially, achieve ~16% higher correlation with human judgment than single-agent evaluation. The improvement disappeared when persona diversity was removed.
^4 Qian et al., "https://aclanthology.org/2024.acl-long.810/," ACL 2024. Showed that treating complex tasks as structured conversations between specialized agents (CEO, CTO, Programmer, Reviewer) enables autonomous completion of multi-step workflows.
^5 Ye et al., "https://arxiv.org/abs/2505.16997," arXiv 2025. Demonstrated that assigning different LLMs to different agent roles outperforms homogeneous systems by up to 47% on mathematical reasoning tasks.
^6 Bo et al., "https://openreview.net/forum?id=wWiAR5mqXq," NeurIPS 2024. Introduced a shared reflector that generates targeted prompt refinements for individual agents using counterfactual reward signals, reducing cascading errors in multi-agent pipelines.
^7 Kim et al., "https://arxiv.org/abs/2408.08631," arXiv 2024. Found that poorly aligned personas degraded performance in 7 of 12 reasoning datasets tested on Llama 3, while their proposed ensemble method outperformed both persona and no-persona baselines.

### Miranda Card
**Name:** Miranda
**Role:** THE EDITOR
**Tag:** hub
**Quote:** "That's all."
**Description:** Miranda is the central intelligence of the pipeline. Every agent reports to her. Every dossier crosses her desk. Every confirmed connection carries her personal verdict. She runs the editorial meeting, sets priorities, and maintains quality standards that are, in her words, "non-negotiable." She uses Claude Sonnet for routine assessments and Claude Opus for human interaction and quality reviews.

### Sub-Agent Cards

**Arthur / THE SCOUT**
Discovers Architectural Digest issues on Archive.org's digital archive. Builds the initial corpus of 480+ issues spanning 1988–2025.
Quote: "Found it. Moving on."

**Casey / THE COURIER**
Downloads issues and extracts article catalogs from JWT-encoded metadata. Delivers structured content to the Reader for extraction.
Quote: "Package delivered."

**Elias / THE READER**
Processes article page images with Claude Vision to extract homeowner names, designers, locations, and design features from every article.
Quote: "I read it twice."

**Silas / THE DETECTIVE**
Cross-references every extracted name against the DOJ Epstein Library and the Little Black Book. Renders tiered verdicts on match strength.
Quote: "The name checks out. Or it doesn't."

**Elena / THE RESEARCHER**
Takes Detective leads and builds comprehensive dossiers: verifying matches, gathering context, and synthesizing narrative assessments.
Quote: "I brought receipts."

**Sable / THE DESIGNER**
Designs and builds the public-facing website. Works iteratively with the human user via Figma Console MCP for live design-to-code workflow.
Quote: "We can do better."

---

## SECTION 4: INVESTIGATION METHODOLOGY

### Subtitle
How a name match becomes a confirmed connection — or gets rejected.

### Body Paragraph 1
The system's credibility depends on its rejection rate. Of the approximately 476 cross-referenced names, only 33 have been confirmed — a 93% rejection rate. This is by design. The pipeline is built to minimize false positives at the cost of some false negatives, because a single false confirmation would undermine the entire project.

### Body Paragraph 2
The investigation follows a four-stage funnel. First, the Reader extracts names from magazine features. Second, the Detective cross-references each name against the DOJ Epstein Library and the Little Black Book, producing a tiered match assessment. Third, the Researcher builds a dossier on every lead that passes the Detective's threshold. Fourth, the Editor renders a binary final verdict — confirmed or rejected — based on the complete dossier.

### Body Paragraph 3
At each stage, the bar rises. A surname match in the Little Black Book (e.g., "Smith") is not enough — 64 of 66 such matches were rejected as coincidence. A full name match in the Black Book with phone numbers is strong evidence. A DOJ document showing someone dined at Epstein's residence is definitive. The pipeline demands documentary evidence of actual contact, not merely shared social networks.

### Summary
Precision over recall. Every confirmed connection has survived automated detection, independent investigation, and editorial review. The 93% rejection rate is the system's integrity metric.

### Evidence Criteria Card 1: WHAT COUNTS AS A CONFIRMED CONNECTION
- A structured Black Book entry with first name, last name, and phone numbers
- DOJ documents showing direct interaction: dining, correspondence, guest lists, appointments
- Flight logs with matching passenger names and dates
- Legal depositions naming the individual in direct Epstein context

### Evidence Criteria Card 2: WHAT DOES NOT COUNT
- Surname-only matches in the Black Book (e.g., "Smith" without first name)
- Merely appearing in a DOJ document without evidence of interaction
- Family members of confirmed connections (each individual assessed independently)
- Negative or adversarial mentions (e.g., Epstein disliking someone)

---

## SECTION 5: INTELLIGENCE INFRASTRUCTURE

### Title
INTELLIGENCE INFRASTRUCTURE

### Subtitle
Six systems that enable agents to learn, coordinate, and improve without human intervention.

### Intro Paragraph 1
Beyond the basic pipeline, the agents share six intelligence subsystems that transform them from isolated task executors into a coordinated learning system. These subsystems are not theoretical — they run in production, and their effects are visible in the pipeline's output quality over time.

### Intro Paragraph 2
Each agent maintains an episodic memory of its own actions and their outcomes. A reflection cycle reviews these episodes periodically, identifying patterns of success and failure. A self-improvement loop proposes methodology changes based on accumulated experience. A shared bulletin board enables cross-agent communication. A world model provides each agent with a structured snapshot of the pipeline's current state. And a curiosity mechanism drives exploration of cross-domain patterns that no single agent would encounter in its own task queue.

### Intro Paragraph 3
These six systems work together. When the Detective's reflection cycle notices that surname-only Black Book matches almost always result in rejection, it adjusts the priority of future surname-only leads downward — freeing capacity for stronger leads. When the Researcher's curiosity mechanism notices that a cluster of confirmed connections share the same interior designer, it posts a bulletin that the Editor can act on. The intelligence is distributed but coordinated.

### Summary
The intelligence infrastructure transforms isolated task execution into coordinated learning. Each subsystem operates continuously, and their combined effect is visible in the pipeline's improving precision over time.

### Subsystem Cards

**EPISODIC MEMORY**
Each agent stores structured episodes — actions, contexts, outcomes — in a JSON-backed vector store. ONNX MiniLM-L6 embeddings enable semantic recall: when facing a new task, the agent retrieves the most relevant past experiences. 10,000-episode capacity with automatic pruning.

**REFLECTION**
Every 10 minutes, each agent reviews its recent episodes and identifies patterns via Claude Haiku. "I notice that surname-only BB matches almost always result in rejection." These reflections influence future task prioritization without explicit reprogramming.

**SELF-IMPROVEMENT**
Every 30 minutes, agents propose methodology changes based on accumulated experience. Proposals follow a structured WHAT/WHY/HOW format and are logged for human review. This is the agent's way of saying "I think I could do this better."

**BULLETIN BOARD**
A shared communication channel where agents post warnings, discoveries, and status updates visible to all. When the Detective escalates a lead, the Researcher sees it immediately. When the Editor rejects a dossier, the reason is broadcast so other agents can adjust.

**WORLD MODEL**
Each agent can request a structured snapshot of the pipeline's current state — active tasks, bottlenecks, queue depths, verdict distributions. This enables context-aware decision-making: the Editor can see that the Researcher is overloaded before assigning new investigations.

**CURIOSITY**
Every 15 minutes, agents explore cross-domain patterns by examining each other's episodic memories. A Researcher might notice that confirmed connections cluster around a specific interior designer. A Detective might notice temporal patterns in match quality. These explorations are serendipitous by design.

---

## SECTION 6: UI DESIGN

### Title
UI DESIGN

### Subtitle
Why an agentic system needs a visual interface — and how it was designed and built.

### Intro Paragraph 1
An agentic pipeline can run entirely in the terminal. So why build a website? Because this project serves three distinct audiences with fundamentally different needs. For the developer, the Agent Office dashboard and real-time status panels transform opaque log files into legible system behavior — you can see when Miranda rejects a dossier or when Silas returns a verdict without parsing thousands of lines of output. For the researcher, the searchable index, dossier pages, and interactive charts make the pipeline's findings explorable in ways that a JSON export never could. For the public reader, the site transforms raw data into a narrative about wealth, taste, and proximity to power.

### Intro Paragraph 2
The website was designed in Figma by Sable, the seventh agent in the pipeline. Unlike the other six agents who operate autonomously, Sable works iteratively with the human user — proposing layouts, refining typography, and building components directly in a shared Figma file. The Figma Console MCP server enables direct read/write access to the Figma file from the development environment, bridging design and code in a single workflow. The design system was defined collaboratively: a 6-column proportional grid, JetBrains Mono for technical sections, Futura PT for the editorial voice, and a restrained palette of copper, gold, and deep purple.

### Intro Paragraph 3
The site is built with Next.js, Tailwind CSS, and Shadcn UI components, deployed on Vercel. All data is fetched server-side from Supabase — no API keys are exposed to the client. The searchable index, dossier pages, and interactive charts all pull from the same live pipeline database. Every number on the page is real and current.

### Summary
The UI exists because different audiences need different views into the same data. The developer needs observability, the researcher needs exploration, and the public reader needs narrative. A terminal can't serve all three.

### Agent Office UI Annotations
01: Agent Network — hierarchical org chart showing all seven agents and their real-time status
02: Editor Inbox — Miranda's real-time commentary on pipeline state, errors, and editorial decisions
03: Newsroom Chatter — the bulletin board. Agents post warnings, discoveries, and status updates visible to all
04: Knowledge Graph — live Neo4j visualization of suspected connections and community clusters
05: Activity Log — per-agent filterable log of every action, streaming in real time
06: Current Leads — active investigation queue with verdict status badges and confidence scores

---

## SECTION 7: LIMITATIONS

### Title
LIMITATIONS

### Subtitle
What this project can and cannot tell you.

### Intro Paragraph 1
The DOJ Epstein Library is searchable only via OCR, which means handwritten documents — notes, address book entries, calendars — are invisible to automated search. The pipeline catches what the text-based search surfaces, but an unknown number of connections exist in documents that only a human reader could parse. This is a fundamental limitation of any automated approach to this corpus.

### Intro Paragraph 2
Name disambiguation remains an imperfect science. The system uses word-boundary matching and minimum name-length thresholds, but common surnames (Smith, Johnson, Williams) will always produce more false positives than rare ones. The 93% rejection rate reflects the system's aggressive filtering, but some false negatives are inevitable — real connections dismissed because the evidence was too ambiguous for automated confirmation.

### Intro Paragraph 3
The Architectural Digest archive covers 1988–2025, but the pre-2010 issues present challenges. Older issues often don't name homeowners in article teasers, leading to "Anonymous" entries that cannot be cross-referenced. The pipeline extracts what the source material contains, but cannot surface names that were never published.

### Summary
This project identifies documented name overlaps between two public datasets. It does not make accusations, cannot access handwritten records, and necessarily misses connections where names were never published or digitized.

### Disclaimer Card: IMPORTANT DISCLAIMER
Appearance in Epstein-related documents does not imply wrongdoing. Many names appear in address books, flight logs, and legal filings for entirely innocuous reasons. "Confirmed connection" means documented proximity — contact entries, dining records, guest lists, correspondence — not implication of criminal activity or personal relationship.

### Known Blind Spots Card
Handwritten documents in the DOJ corpus are invisible to OCR search. Pre-2010 AD issues often omit homeowner names. Common surnames produce unavoidable false positives. The pipeline catches what text-based search surfaces — an unknown number of real connections exist in records only a human reader could parse.

---

## SECTION 8: DATA SOURCES

### Title
DATA SOURCES

### Subtitle
Primary sources, infrastructure, and the full codebase.

### Intro Paragraph 1
The pipeline draws from three primary data sources. Archive.org provides the complete digital archive of Architectural Digest from 1988 to 2025 — approximately 480 issues with page images and structured article catalogs accessible via JWT-encoded metadata. The DOJ Epstein Library contains millions of pages of released legal documents, depositions, correspondence, and records searchable through OCR. Epstein's Little Black Book, released through civil litigation, provides approximately 1,500 contact entries with names and phone numbers.

### Intro Paragraph 2
The extracted data lives in two databases: Supabase (PostgreSQL) for all structured records — features, cross-references, dossiers, verdicts, and pipeline state — and Neo4j Aura for the knowledge graph, which maps relationships between people, designers, locations, styles, and Epstein sources. All queries are server-side. No API keys or database credentials are exposed to the client.

### Intro Paragraph 3
The full source code — the multi-agent pipeline, website, analysis tools, and this methodology section — is available for inspection. The methodology is fully reproducible: given the same source data and the same pipeline code, the same results will emerge.

### Summary
Three primary sources, two databases, one open codebase. Every finding is independently verifiable against the original documents.

### Data Source Cards

**Archive.org Digital Library** [PRIMARY]
Complete Architectural Digest archive from 1988-2025. ~480 issues with page images and JWT-encoded article catalogs.

**DOJ Epstein Library** [PRIMARY]
Millions of pages of released legal documents, depositions, correspondence, and records. OCR-searchable.

**Epstein's Little Black Book** [PRIMARY]
~1,500 contact entries with names and phone numbers. Released through civil litigation.

**Supabase (PostgreSQL)** [INFRA]
All structured pipeline data: features, cross-references, dossiers, verdicts, aesthetic profiles, and pipeline state.

**Neo4j Aura** [INFRA]
Knowledge graph mapping relationships between people, designers, locations, styles, and Epstein sources.

**GitHub Repository** [CODE]
Full source code: multi-agent pipeline, website, analysis tools, and documentation. Independently auditable.

---

## SECTION 9: CONCLUSIONS

### Title
CONCLUSIONS

### Subtitle
What the data reveals about wealth, taste, and proximity to power.

### Intro Paragraph 1
The AD-Epstein Index demonstrates that the overlap between Architectural Digest's featured population and Jeffrey Epstein's documented social network is structurally significant. Of the approximately 2,180 featured residences cataloged across 37 years of the magazine, 33 belong to individuals whose names appear in Epstein's contact records, DOJ documents, or both — confirmed through a multi-stage verification process with a 93% rejection rate for false positives.

### Intro Paragraph 2
The confirmed individuals are not randomly distributed across the magazine's history or aesthetic spectrum. They cluster in specific decades, specific geographies, and specific design traditions. The six-dimension aesthetic taxonomy reveals a pronounced signature: classical European grandeur, old masters and antiques, maximalist layering, and formal symmetry are dramatically overrepresented among Epstein-connected homeowners relative to the general AD population. Minimalism and industrial modernism are virtually absent.

### Intro Paragraph 3
This pattern is not an accusation — it is a finding. The project documents that Epstein's social orbit overlapped heavily with a specific stratum of wealth and taste that AD has celebrated for decades. The same world of inherited aesthetics, European collecting traditions, and old-money grandeur that the magazine profiles is the world that Epstein moved through. The data makes this overlap visible and measurable for the first time.

### Summary
The AD-Epstein Index is a proof of concept: that autonomous AI agents can conduct non-trivial investigative research at minimal cost, and that the results — when built on rigorous methodology and transparent sourcing — surface patterns that would be invisible to any single human researcher working alone.
