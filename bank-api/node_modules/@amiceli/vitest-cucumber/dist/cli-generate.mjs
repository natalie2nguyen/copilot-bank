#!/usr/bin/env node
import minimist from "minimist";
import { dirname } from "node:path";
import callsites from "callsites";
import parsecurrency from "parsecurrency";
import fs from "node:fs";
import readline from "node:readline";
import fs$1 from "node:fs/promises";
//#region src/errors/errors.ts
var VitestsCucumberError = class extends Error {
	constructor(message, name) {
		super(message);
		this.stack = ``;
		this.name = name || this.constructor.name;
	}
};
var NotScenarioOutlineError = class extends VitestsCucumberError {
	constructor(scenario) {
		super(`${scenario.getTitle()} is not a ScenarioOutline`);
	}
};
var IsScenarioOutlineError = class extends VitestsCucumberError {
	constructor(scenario) {
		super(`${scenario.getTitle()} is a ScenarioOutline`);
	}
};
var BackgroundNotCalledError = class extends VitestsCucumberError {
	constructor(background) {
		super(`${background.getTitle()} was not called`);
	}
};
var ScenarioNotCalledError = class extends VitestsCucumberError {
	constructor(scenario) {
		super(`${scenario.getTitle()} was not called`);
	}
};
var FeatureUknowScenarioError = class extends VitestsCucumberError {
	constructor(feature, scenario) {
		super(`${scenario.getTitle()} does not exist in \n ${feature.getTitle()}`);
	}
};
var StepAbleUnknowStepError = class extends VitestsCucumberError {
	constructor(stepable, step) {
		super(`${stepable.getTitle()} \n ${step.type} ${step.details} does not exist`);
	}
};
var StepAbleStepExpressionError = class extends VitestsCucumberError {
	constructor(stepable, step) {
		super([
			`No step match with this expression`,
			`   ${stepable.getTitle()}`,
			`       ${step.getTitle()} ❌`
		].join(`\n`));
	}
};
var StepAbleStepsNotCalledError = class extends VitestsCucumberError {
	constructor(stepable, step) {
		super([
			``,
			`    ${stepable.getTitle()}`,
			`        ${step.getTitle()} ❌`
		].join(`\n`), `Missing steps in Scenario`);
	}
};
var RuleNotCalledError = class extends VitestsCucumberError {
	constructor(rule) {
		super(`${rule.getTitle()} was not called`);
	}
};
var FeatureUknowRuleError = class extends VitestsCucumberError {
	constructor(feature, rule) {
		super(`${rule.getTitle()} does not exist in \n Feature: ${feature.name}`);
	}
};
var FeatureFileNotFoundError = class extends VitestsCucumberError {
	constructor(path) {
		super(`feature file ${path} does not exist`);
	}
};
var NotAllowedBackgroundStepTypeError = class extends VitestsCucumberError {
	constructor(type) {
		super(`${type} step is not allowed in Background`);
	}
};
var TwiceBackgroundError = class extends VitestsCucumberError {
	constructor() {
		super(`A background already exist`);
	}
};
var BackgroundNotExistsError = class extends VitestsCucumberError {
	constructor(parent) {
		super(`${parent.getTitle()} has no background`);
	}
};
var OnlyOneFeatureError = class extends VitestsCucumberError {
	constructor() {
		super(`Gherkin rule: only one Feature per file`);
	}
};
var StepExpressionMatchError = class extends VitestsCucumberError {
	constructor(step, expression) {
		super(`${expression} no match with ${step.details}`);
	}
};
var MissingFeature = class extends VitestsCucumberError {
	constructor(line) {
		super([`Missing Feature before add Scenario, Rule or Background`, `   ${line.trim()} ❌`].join("\n"));
	}
};
var MissingSteppableError = class extends VitestsCucumberError {
	constructor(line) {
		super([`Missing Scenario, ScenarioOutline or Background before add step`, `   ${line.trim()} ❌`].join("\n"));
	}
};
var MissingScnearioOutlineError = class extends VitestsCucumberError {
	constructor(line) {
		super([`Missing ScenarioOutline before add Examples`, `   ${line.trim()} ❌`].join("\n"));
	}
};
var MissingExamplesError = class extends VitestsCucumberError {
	constructor(line) {
		super([`Missing Examples before add value`, `   ${line.trim()} ❌`].join("\n"));
	}
};
var SpokenKeywordError = class extends VitestsCucumberError {
	constructor(line, keywords) {
		super([`No keywords match for: ${line}`, `   Available keywords : ${keywords.join(", ")}`].join("\n"));
	}
};
var ParentWithoutScenario = class extends VitestsCucumberError {
	constructor(feature) {
		super(`${feature.getTitle()} must have at least one scenario`);
	}
};
var InvalidUrlParameterError = class extends VitestsCucumberError {
	constructor(arg) {
		super(`String '${arg}' was not recognized as a valid Url`);
	}
};
var InvalidDateParameterError = class extends VitestsCucumberError {
	constructor(arg) {
		super(`String '${arg}' was not recognized as a valid Date`);
	}
};
var InvalidCurrencyParameterError = class extends VitestsCucumberError {
	constructor(arg) {
		super(`String '${arg}' was not recognized as a valid currency`);
	}
};
var ItemAlreadyExistsError = class extends VitestsCucumberError {
	constructor(parent, child) {
		super(`${parent.getTitle()} already has ${child.getTitle()}`);
	}
};
var RequiredTitleError = class extends VitestsCucumberError {
	constructor(line, keyword) {
		super([`${line} ❌`, `   ${keyword} required a title`].join("\n"));
	}
};
//#endregion
//#region src/parser/models/step.ts
var Step = class {
	type;
	details;
	docStrings = null;
	isCalled;
	dataTables = [];
	title;
	constructor(type, details, title) {
		this.details = details;
		this.type = type;
		this.isCalled = false;
		this.title = title || `${type}`;
	}
	getTitle() {
		return `${this.title} ${this.details}`;
	}
	setDocStrings(docStrings) {
		this.docStrings = docStrings;
	}
	matchStep(step) {
		if (this.type === "Step") return this.details === step.details;
		return this.type === step.type && this.details === step.details;
	}
};
//#endregion
//#region src/parser/lang/lang.json
var en = {
	"and": ["* ", "And "],
	"background": ["Background"],
	"but": ["But "],
	"examples": ["Examples", "Scenarios"],
	"feature": [
		"Feature",
		"Business Need",
		"Ability"
	],
	"given": ["Given "],
	"name": "English",
	"native": "English",
	"rule": ["Rule"],
	"scenario": ["Example", "Scenario"],
	"scenarioOutline": ["Scenario Outline", "Scenario Template"],
	"then": ["Then "],
	"when": ["When "]
};
var lang_default = {
	af: {
		"and": ["* ", "En "],
		"background": ["Agtergrond"],
		"but": ["Maar "],
		"examples": ["Voorbeelde"],
		"feature": [
			"Funksie",
			"Besigheid Behoefte",
			"Vermoë"
		],
		"given": ["Gegewe "],
		"name": "Afrikaans",
		"native": "Afrikaans",
		"rule": ["Regel"],
		"scenario": ["Voorbeeld", "Situasie"],
		"scenarioOutline": ["Situasie Uiteensetting"],
		"then": ["Dan "],
		"when": ["Wanneer "]
	},
	am: {
		"and": ["* ", "Եվ "],
		"background": ["Կոնտեքստ"],
		"but": ["Բայց "],
		"examples": ["Օրինակներ"],
		"feature": ["Ֆունկցիոնալություն", "Հատկություն"],
		"given": ["Դիցուք "],
		"name": "Armenian",
		"native": "հայերեն",
		"rule": ["Rule"],
		"scenario": ["Օրինակ", "Սցենար"],
		"scenarioOutline": ["Սցենարի կառուցվացքը"],
		"then": ["Ապա "],
		"when": ["Եթե ", "Երբ "]
	},
	an: {
		"and": [
			"* ",
			"Y ",
			"E "
		],
		"background": ["Antecedents"],
		"but": ["Pero "],
		"examples": ["Eixemplos"],
		"feature": ["Caracteristica"],
		"given": [
			"Dau ",
			"Dada ",
			"Daus ",
			"Dadas "
		],
		"name": "Aragonese",
		"native": "Aragonés",
		"rule": ["Rule"],
		"scenario": ["Eixemplo", "Caso"],
		"scenarioOutline": ["Esquema del caso"],
		"then": [
			"Alavez ",
			"Allora ",
			"Antonces "
		],
		"when": ["Cuan "]
	},
	ar: {
		"and": ["* ", "و "],
		"background": ["الخلفية"],
		"but": ["لكن "],
		"examples": ["امثلة"],
		"feature": ["خاصية"],
		"given": ["بفرض "],
		"name": "Arabic",
		"native": "العربية",
		"rule": ["Rule"],
		"scenario": ["مثال", "سيناريو"],
		"scenarioOutline": ["سيناريو مخطط"],
		"then": ["اذاً ", "ثم "],
		"when": ["متى ", "عندما "]
	},
	ast: {
		"and": [
			"* ",
			"Y ",
			"Ya "
		],
		"background": ["Antecedentes"],
		"but": ["Peru "],
		"examples": ["Exemplos"],
		"feature": ["Carauterística"],
		"given": [
			"Dáu ",
			"Dada ",
			"Daos ",
			"Daes "
		],
		"name": "Asturian",
		"native": "asturianu",
		"rule": ["Rule"],
		"scenario": ["Exemplo", "Casu"],
		"scenarioOutline": ["Esbozu del casu"],
		"then": ["Entós "],
		"when": ["Cuando "]
	},
	az: {
		"and": [
			"* ",
			"Və ",
			"Həm "
		],
		"background": ["Keçmiş", "Kontekst"],
		"but": ["Amma ", "Ancaq "],
		"examples": ["Nümunələr"],
		"feature": ["Özəllik"],
		"given": ["Tutaq ki ", "Verilir "],
		"name": "Azerbaijani",
		"native": "Azərbaycanca",
		"rule": ["Rule"],
		"scenario": ["Nümunə", "Ssenari"],
		"scenarioOutline": ["Ssenarinin strukturu"],
		"then": ["O halda "],
		"when": ["Əgər ", "Nə vaxt ki "]
	},
	be: {
		"and": [
			"* ",
			"I ",
			"Ды ",
			"Таксама "
		],
		"background": ["Кантэкст"],
		"but": ["Але ", "Інакш "],
		"examples": ["Прыклады"],
		"feature": ["Функцыянальнасць", "Фіча"],
		"given": ["Няхай ", "Дадзена "],
		"name": "Belarusian",
		"native": "Беларуская",
		"rule": ["Правілы"],
		"scenario": ["Сцэнарый", "Cцэнар"],
		"scenarioOutline": ["Шаблон сцэнарыя", "Узор сцэнара"],
		"then": ["Тады "],
		"when": ["Калі "]
	},
	bg: {
		"and": ["* ", "И "],
		"background": ["Предистория"],
		"but": ["Но "],
		"examples": ["Примери"],
		"feature": ["Функционалност"],
		"given": ["Дадено "],
		"name": "Bulgarian",
		"native": "български",
		"rule": ["Правило"],
		"scenario": ["Пример", "Сценарий"],
		"scenarioOutline": ["Рамка на сценарий"],
		"then": ["То "],
		"when": ["Когато "]
	},
	bm: {
		"and": ["* ", "Dan "],
		"background": ["Latar Belakang"],
		"but": ["Tetapi ", "Tapi "],
		"examples": ["Contoh"],
		"feature": ["Fungsi"],
		"given": ["Diberi ", "Bagi "],
		"name": "Malay",
		"native": "Bahasa Melayu",
		"rule": ["Rule"],
		"scenario": [
			"Senario",
			"Situasi",
			"Keadaan"
		],
		"scenarioOutline": [
			"Kerangka Senario",
			"Kerangka Situasi",
			"Kerangka Keadaan",
			"Garis Panduan Senario"
		],
		"then": ["Maka ", "Kemudian "],
		"when": ["Apabila "]
	},
	bs: {
		"and": [
			"* ",
			"I ",
			"A "
		],
		"background": ["Pozadina"],
		"but": ["Ali "],
		"examples": ["Primjeri"],
		"feature": ["Karakteristika"],
		"given": ["Dato "],
		"name": "Bosnian",
		"native": "Bosanski",
		"rule": ["Rule"],
		"scenario": [
			"Primjer",
			"Scenariju",
			"Scenario"
		],
		"scenarioOutline": ["Scenariju-obris", "Scenario-outline"],
		"then": ["Zatim "],
		"when": ["Kada "]
	},
	ca: {
		"and": ["* ", "I "],
		"background": ["Rerefons", "Antecedents"],
		"but": ["Però "],
		"examples": ["Exemples"],
		"feature": ["Característica", "Funcionalitat"],
		"given": [
			"Donat ",
			"Donada ",
			"Atès ",
			"Atesa "
		],
		"name": "Catalan",
		"native": "català",
		"rule": ["Rule"],
		"scenario": ["Exemple", "Escenari"],
		"scenarioOutline": ["Esquema de l'escenari"],
		"then": ["Aleshores ", "Cal "],
		"when": ["Quan "]
	},
	cs: {
		"and": [
			"* ",
			"A také ",
			"A "
		],
		"background": ["Pozadí", "Kontext"],
		"but": ["Ale "],
		"examples": ["Příklady"],
		"feature": ["Požadavek"],
		"given": ["Pokud ", "Za předpokladu "],
		"name": "Czech",
		"native": "Česky",
		"rule": ["Pravidlo"],
		"scenario": ["Příklad", "Scénář"],
		"scenarioOutline": ["Náčrt Scénáře", "Osnova scénáře"],
		"then": ["Pak "],
		"when": ["Když "]
	},
	"cy-GB": {
		"and": ["* ", "A "],
		"background": ["Cefndir"],
		"but": ["Ond "],
		"examples": ["Enghreifftiau"],
		"feature": ["Arwedd"],
		"given": ["Anrhegedig a "],
		"name": "Welsh",
		"native": "Cymraeg",
		"rule": ["Rule"],
		"scenario": ["Enghraifft", "Scenario"],
		"scenarioOutline": ["Scenario Amlinellol"],
		"then": ["Yna "],
		"when": ["Pryd "]
	},
	da: {
		"and": ["* ", "Og "],
		"background": ["Baggrund"],
		"but": ["Men "],
		"examples": ["Eksempler"],
		"feature": ["Egenskab"],
		"given": ["Givet "],
		"name": "Danish",
		"native": "dansk",
		"rule": ["Regel"],
		"scenario": ["Eksempel", "Scenarie"],
		"scenarioOutline": ["Abstrakt Scenario"],
		"then": ["Så "],
		"when": ["Når "]
	},
	de: {
		"and": ["* ", "Und "],
		"background": [
			"Grundlage",
			"Hintergrund",
			"Voraussetzungen",
			"Vorbedingungen"
		],
		"but": ["Aber "],
		"examples": ["Beispiele"],
		"feature": ["Funktionalität", "Funktion"],
		"given": [
			"Angenommen ",
			"Gegeben sei ",
			"Gegeben seien "
		],
		"name": "German",
		"native": "Deutsch",
		"rule": ["Rule", "Regel"],
		"scenario": ["Beispiel", "Szenario"],
		"scenarioOutline": ["Szenariogrundriss", "Szenarien"],
		"then": ["Dann "],
		"when": ["Wenn "]
	},
	el: {
		"and": ["* ", "Και "],
		"background": ["Υπόβαθρο"],
		"but": ["Αλλά "],
		"examples": ["Παραδείγματα", "Σενάρια"],
		"feature": ["Δυνατότητα", "Λειτουργία"],
		"given": ["Δεδομένου "],
		"name": "Greek",
		"native": "Ελληνικά",
		"rule": ["Rule"],
		"scenario": ["Παράδειγμα", "Σενάριο"],
		"scenarioOutline": ["Περιγραφή Σεναρίου", "Περίγραμμα Σεναρίου"],
		"then": ["Τότε "],
		"when": ["Όταν "]
	},
	em: {
		"and": ["* ", "😂"],
		"background": ["💤"],
		"but": ["😔"],
		"examples": ["📓"],
		"feature": ["📚"],
		"given": ["😐"],
		"name": "Emoji",
		"native": "😀",
		"rule": ["Rule"],
		"scenario": ["🥒", "📕"],
		"scenarioOutline": ["📖"],
		"then": ["🙏"],
		"when": ["🎬"]
	},
	en,
	"en-Scouse": {
		"and": ["* ", "An "],
		"background": ["Dis is what went down"],
		"but": ["Buh "],
		"examples": ["Examples"],
		"feature": ["Feature"],
		"given": ["Givun ", "Youse know when youse got "],
		"name": "Scouse",
		"native": "Scouse",
		"rule": ["Rule"],
		"scenario": ["The thing of it is"],
		"scenarioOutline": ["Wharrimean is"],
		"then": ["Dun ", "Den youse gotta "],
		"when": ["Wun ", "Youse know like when "]
	},
	"en-au": {
		"and": ["* ", "Too right "],
		"background": ["First off"],
		"but": ["Yeah nah "],
		"examples": ["You'll wanna"],
		"feature": ["Pretty much"],
		"given": ["Y'know "],
		"name": "Australian",
		"native": "Australian",
		"rule": ["Rule"],
		"scenario": ["Awww, look mate"],
		"scenarioOutline": ["Reckon it's like"],
		"then": ["But at the end of the day I reckon "],
		"when": ["It's just unbelievable "]
	},
	"en-lol": {
		"and": ["* ", "AN "],
		"background": ["B4"],
		"but": ["BUT "],
		"examples": ["EXAMPLZ"],
		"feature": ["OH HAI"],
		"given": ["I CAN HAZ "],
		"name": "LOLCAT",
		"native": "LOLCAT",
		"rule": ["Rule"],
		"scenario": ["MISHUN"],
		"scenarioOutline": ["MISHUN SRSLY"],
		"then": ["DEN "],
		"when": ["WEN "]
	},
	"en-old": {
		"and": [
			"* ",
			"Ond ",
			"7 "
		],
		"background": ["Aer", "Ær"],
		"but": ["Ac "],
		"examples": [
			"Se the",
			"Se þe",
			"Se ðe"
		],
		"feature": ["Hwaet", "Hwæt"],
		"given": [
			"Thurh ",
			"Þurh ",
			"Ðurh "
		],
		"name": "Old English",
		"native": "Englisc",
		"rule": ["Rule"],
		"scenario": ["Swa"],
		"scenarioOutline": ["Swa hwaer swa", "Swa hwær swa"],
		"then": [
			"Tha ",
			"Þa ",
			"Ða ",
			"Tha the ",
			"Þa þe ",
			"Ða ðe "
		],
		"when": [
			"Bæþsealf ",
			"Bæþsealfa ",
			"Bæþsealfe ",
			"Ciricæw ",
			"Ciricæwe ",
			"Ciricæwa "
		]
	},
	"en-pirate": {
		"and": ["* ", "Aye "],
		"background": ["Yo-ho-ho"],
		"but": ["Avast! "],
		"examples": ["Dead men tell no tales"],
		"feature": ["Ahoy matey!"],
		"given": ["Gangway! "],
		"name": "Pirate",
		"native": "Pirate",
		"rule": ["Rule"],
		"scenario": ["Heave to"],
		"scenarioOutline": ["Shiver me timbers"],
		"then": ["Let go and haul "],
		"when": ["Blimey! "]
	},
	"en-tx": {
		"and": ["Come hell or high water "],
		"background": ["Lemme tell y'all a story"],
		"but": ["Well now hold on, I'll you what "],
		"examples": ["Now that's a story longer than a cattle drive in July"],
		"feature": ["This ain’t my first rodeo", "All gussied up"],
		"given": ["Fixin' to ", "All git out "],
		"name": "Texas",
		"native": "Texas",
		"rule": ["Rule "],
		"scenario": ["All hat and no cattle"],
		"scenarioOutline": ["Serious as a snake bite", "Busy as a hound in flea season"],
		"then": ["There’s no tree but bears some fruit "],
		"when": ["Quick out of the chute "]
	},
	eo: {
		"and": ["* ", "Kaj "],
		"background": ["Fono"],
		"but": ["Sed "],
		"examples": ["Ekzemploj"],
		"feature": ["Trajto"],
		"given": ["Donitaĵo ", "Komence "],
		"name": "Esperanto",
		"native": "Esperanto",
		"rule": ["Regulo"],
		"scenario": [
			"Ekzemplo",
			"Scenaro",
			"Kazo"
		],
		"scenarioOutline": [
			"Konturo de la scenaro",
			"Skizo",
			"Kazo-skizo"
		],
		"then": ["Do "],
		"when": ["Se "]
	},
	es: {
		"and": [
			"* ",
			"Y ",
			"E "
		],
		"background": ["Antecedentes"],
		"but": ["Pero "],
		"examples": ["Ejemplos"],
		"feature": [
			"Característica",
			"Necesidad del negocio",
			"Requisito"
		],
		"given": [
			"Dado ",
			"Dada ",
			"Dados ",
			"Dadas "
		],
		"name": "Spanish",
		"native": "español",
		"rule": ["Regla", "Regla de negocio"],
		"scenario": ["Ejemplo", "Escenario"],
		"scenarioOutline": ["Esquema del escenario"],
		"then": ["Entonces "],
		"when": ["Cuando "]
	},
	et: {
		"and": ["* ", "Ja "],
		"background": ["Taust"],
		"but": ["Kuid "],
		"examples": ["Juhtumid"],
		"feature": ["Omadus"],
		"given": ["Eeldades "],
		"name": "Estonian",
		"native": "eesti keel",
		"rule": ["Reegel"],
		"scenario": ["Juhtum", "Stsenaarium"],
		"scenarioOutline": ["Raamjuhtum", "Raamstsenaarium"],
		"then": ["Siis "],
		"when": ["Kui "]
	},
	fa: {
		"and": ["* ", "و "],
		"background": ["زمینه"],
		"but": ["اما "],
		"examples": ["نمونه ها"],
		"feature": ["وِیژگی"],
		"given": ["با فرض "],
		"name": "Persian",
		"native": "فارسی",
		"rule": ["Rule"],
		"scenario": ["مثال", "سناریو"],
		"scenarioOutline": ["الگوی سناریو"],
		"then": ["آنگاه "],
		"when": ["هنگامی "]
	},
	fi: {
		"and": ["* ", "Ja "],
		"background": ["Tausta"],
		"but": ["Mutta "],
		"examples": ["Tapaukset"],
		"feature": ["Ominaisuus"],
		"given": ["Oletetaan "],
		"name": "Finnish",
		"native": "suomi",
		"rule": ["Rule"],
		"scenario": ["Tapaus"],
		"scenarioOutline": ["Tapausaihio"],
		"then": ["Niin "],
		"when": ["Kun "]
	},
	fr: {
		"and": [
			"* ",
			"Et que ",
			"Et qu'",
			"Et "
		],
		"background": ["Contexte"],
		"but": [
			"Mais que ",
			"Mais qu'",
			"Mais "
		],
		"examples": ["Exemples"],
		"feature": ["Fonctionnalité"],
		"given": [
			"Soit ",
			"Sachant que ",
			"Sachant qu'",
			"Sachant ",
			"Etant donné que ",
			"Etant donné qu'",
			"Etant donné ",
			"Etant donnée ",
			"Etant donnés ",
			"Etant données ",
			"Étant donné que ",
			"Étant donné qu'",
			"Étant donné ",
			"Étant donnée ",
			"Étant donnés ",
			"Étant données "
		],
		"name": "French",
		"native": "français",
		"rule": ["Règle"],
		"scenario": ["Exemple", "Scénario"],
		"scenarioOutline": ["Plan du scénario", "Plan du Scénario"],
		"then": ["Alors ", "Donc "],
		"when": [
			"Quand ",
			"Lorsque ",
			"Lorsqu'"
		]
	},
	ga: {
		"and": ["* ", "Agus "],
		"background": ["Cúlra"],
		"but": ["Ach "],
		"examples": ["Samplaí"],
		"feature": ["Gné"],
		"given": [
			"Cuir i gcás go ",
			"Cuir i gcás nach ",
			"Cuir i gcás gur ",
			"Cuir i gcás nár "
		],
		"name": "Irish",
		"native": "Gaeilge",
		"rule": ["Riail"],
		"scenario": ["Sampla", "Cás"],
		"scenarioOutline": ["Cás Achomair"],
		"then": ["Ansin "],
		"when": [
			"Nuair a ",
			"Nuair nach ",
			"Nuair ba ",
			"Nuair nár "
		]
	},
	gj: {
		"and": ["* ", "અને "],
		"background": ["બેકગ્રાઉન્ડ"],
		"but": ["પણ "],
		"examples": ["ઉદાહરણો"],
		"feature": [
			"લક્ષણ",
			"વ્યાપાર જરૂર",
			"ક્ષમતા"
		],
		"given": ["આપેલ છે "],
		"name": "Gujarati",
		"native": "ગુજરાતી",
		"rule": ["નિયમ"],
		"scenario": ["ઉદાહરણ", "સ્થિતિ"],
		"scenarioOutline": ["પરિદ્દશ્ય રૂપરેખા", "પરિદ્દશ્ય ઢાંચો"],
		"then": ["પછી "],
		"when": ["ક્યારે "]
	},
	gl: {
		"and": ["* ", "E "],
		"background": ["Contexto"],
		"but": ["Mais ", "Pero "],
		"examples": ["Exemplos"],
		"feature": ["Característica"],
		"given": [
			"Dado ",
			"Dada ",
			"Dados ",
			"Dadas "
		],
		"name": "Galician",
		"native": "galego",
		"rule": ["Rule"],
		"scenario": ["Exemplo", "Escenario"],
		"scenarioOutline": ["Esbozo do escenario"],
		"then": ["Entón ", "Logo "],
		"when": ["Cando "]
	},
	he: {
		"and": ["* ", "וגם "],
		"background": ["רקע"],
		"but": ["אבל "],
		"examples": ["דוגמאות"],
		"feature": ["תכונה"],
		"given": ["בהינתן "],
		"name": "Hebrew",
		"native": "עברית",
		"rule": ["כלל"],
		"scenario": ["דוגמא", "תרחיש"],
		"scenarioOutline": ["תבנית תרחיש"],
		"then": ["אז ", "אזי "],
		"when": ["כאשר "]
	},
	hi: {
		"and": [
			"* ",
			"और ",
			"तथा "
		],
		"background": ["पृष्ठभूमि"],
		"but": [
			"पर ",
			"परन्तु ",
			"किन्तु "
		],
		"examples": ["उदाहरण"],
		"feature": ["रूप लेख"],
		"given": [
			"अगर ",
			"यदि ",
			"चूंकि "
		],
		"name": "Hindi",
		"native": "हिंदी",
		"rule": ["नियम"],
		"scenario": ["परिदृश्य"],
		"scenarioOutline": ["परिदृश्य रूपरेखा"],
		"then": ["तब ", "तदा "],
		"when": ["जब ", "कदा "]
	},
	hr: {
		"and": ["* ", "I "],
		"background": ["Pozadina"],
		"but": ["Ali "],
		"examples": ["Primjeri", "Scenariji"],
		"feature": [
			"Osobina",
			"Mogućnost",
			"Mogucnost"
		],
		"given": [
			"Zadan ",
			"Zadani ",
			"Zadano ",
			"Ukoliko "
		],
		"name": "Croatian",
		"native": "hrvatski",
		"rule": ["Rule"],
		"scenario": ["Primjer", "Scenarij"],
		"scenarioOutline": ["Skica", "Koncept"],
		"then": ["Onda "],
		"when": ["Kada ", "Kad "]
	},
	ht: {
		"and": [
			"* ",
			"Ak ",
			"Epi ",
			"E "
		],
		"background": ["Kontèks", "Istorik"],
		"but": ["Men "],
		"examples": ["Egzanp"],
		"feature": [
			"Karakteristik",
			"Mak",
			"Fonksyonalite"
		],
		"given": [
			"Sipoze ",
			"Sipoze ke ",
			"Sipoze Ke "
		],
		"name": "Creole",
		"native": "kreyòl",
		"rule": ["Rule"],
		"scenario": ["Senaryo"],
		"scenarioOutline": [
			"Plan senaryo",
			"Plan Senaryo",
			"Senaryo deskripsyon",
			"Senaryo Deskripsyon",
			"Dyagram senaryo",
			"Dyagram Senaryo"
		],
		"then": ["Lè sa a ", "Le sa a "],
		"when": ["Lè ", "Le "]
	},
	hu: {
		"and": ["* ", "És "],
		"background": ["Háttér"],
		"but": ["De "],
		"examples": ["Példák"],
		"feature": ["Jellemző"],
		"given": ["Amennyiben ", "Adott "],
		"name": "Hungarian",
		"native": "magyar",
		"rule": ["Szabály"],
		"scenario": ["Példa", "Forgatókönyv"],
		"scenarioOutline": ["Forgatókönyv vázlat"],
		"then": ["Akkor "],
		"when": [
			"Majd ",
			"Ha ",
			"Amikor "
		]
	},
	id: {
		"and": ["* ", "Dan "],
		"background": ["Dasar", "Latar Belakang"],
		"but": ["Tapi ", "Tetapi "],
		"examples": ["Contoh", "Misal"],
		"feature": ["Fitur"],
		"given": [
			"Dengan ",
			"Diketahui ",
			"Diasumsikan ",
			"Bila ",
			"Jika "
		],
		"name": "Indonesian",
		"native": "Bahasa Indonesia",
		"rule": ["Rule", "Aturan"],
		"scenario": ["Skenario"],
		"scenarioOutline": ["Skenario konsep", "Garis-Besar Skenario"],
		"then": ["Maka ", "Kemudian "],
		"when": ["Ketika "]
	},
	is: {
		"and": ["* ", "Og "],
		"background": ["Bakgrunnur"],
		"but": ["En "],
		"examples": ["Dæmi", "Atburðarásir"],
		"feature": ["Eiginleiki"],
		"given": ["Ef "],
		"name": "Icelandic",
		"native": "Íslenska",
		"rule": ["Rule"],
		"scenario": ["Atburðarás"],
		"scenarioOutline": ["Lýsing Atburðarásar", "Lýsing Dæma"],
		"then": ["Þá "],
		"when": ["Þegar "]
	},
	it: {
		"and": [
			"* ",
			"E ",
			"Ed "
		],
		"background": ["Contesto"],
		"but": ["Ma "],
		"examples": ["Esempi"],
		"feature": [
			"Funzionalità",
			"Esigenza di Business",
			"Abilità"
		],
		"given": [
			"Dato ",
			"Data ",
			"Dati ",
			"Date "
		],
		"name": "Italian",
		"native": "italiano",
		"rule": ["Regola"],
		"scenario": ["Esempio", "Scenario"],
		"scenarioOutline": ["Schema dello scenario"],
		"then": ["Allora "],
		"when": ["Quando "]
	},
	ja: {
		"and": [
			"* ",
			"且つ",
			"かつ"
		],
		"background": ["背景"],
		"but": [
			"然し",
			"しかし",
			"但し",
			"ただし"
		],
		"examples": ["例", "サンプル"],
		"feature": ["フィーチャ", "機能"],
		"given": ["前提"],
		"name": "Japanese",
		"native": "日本語",
		"rule": ["ルール"],
		"scenario": ["シナリオ"],
		"scenarioOutline": [
			"シナリオアウトライン",
			"シナリオテンプレート",
			"テンプレ",
			"シナリオテンプレ"
		],
		"then": ["ならば"],
		"when": ["もし"]
	},
	jv: {
		"and": ["* ", "Lan "],
		"background": ["Dasar"],
		"but": [
			"Tapi ",
			"Nanging ",
			"Ananging "
		],
		"examples": ["Conto", "Contone"],
		"feature": ["Fitur"],
		"given": ["Nalika ", "Nalikaning "],
		"name": "Javanese",
		"native": "Basa Jawa",
		"rule": ["Rule"],
		"scenario": ["Skenario"],
		"scenarioOutline": ["Konsep skenario"],
		"then": ["Njuk ", "Banjur "],
		"when": ["Manawa ", "Menawa "]
	},
	ka: {
		"and": [
			"* ",
			"და ",
			"ასევე "
		],
		"background": ["კონტექსტი"],
		"but": ["მაგრამ ", "თუმცა "],
		"examples": ["მაგალითები"],
		"feature": ["თვისება", "მოთხოვნა"],
		"given": [
			"მოცემული ",
			"მოცემულია ",
			"ვთქვათ "
		],
		"name": "Georgian",
		"native": "ქართული",
		"rule": ["წესი"],
		"scenario": [
			"მაგალითად",
			"მაგალითი",
			"მაგ",
			"სცენარი"
		],
		"scenarioOutline": [
			"სცენარის ნიმუში",
			"სცენარის შაბლონი",
			"ნიმუში",
			"შაბლონი"
		],
		"then": ["მაშინ "],
		"when": [
			"როდესაც ",
			"როცა ",
			"როგორც კი ",
			"თუ "
		]
	},
	kn: {
		"and": ["* ", "ಮತ್ತು "],
		"background": ["ಹಿನ್ನೆಲೆ"],
		"but": ["ಆದರೆ "],
		"examples": ["ಉದಾಹರಣೆಗಳು"],
		"feature": ["ಹೆಚ್ಚಳ"],
		"given": ["ನೀಡಿದ "],
		"name": "Kannada",
		"native": "ಕನ್ನಡ",
		"rule": ["Rule"],
		"scenario": ["ಉದಾಹರಣೆ", "ಕಥಾಸಾರಾಂಶ"],
		"scenarioOutline": ["ವಿವರಣೆ"],
		"then": ["ನಂತರ "],
		"when": ["ಸ್ಥಿತಿಯನ್ನು "]
	},
	ko: {
		"and": ["* ", "그리고 "],
		"background": ["배경"],
		"but": ["하지만 ", "단 "],
		"examples": ["예"],
		"feature": ["기능"],
		"given": ["조건 ", "먼저 "],
		"name": "Korean",
		"native": "한국어",
		"rule": ["Rule"],
		"scenario": ["시나리오"],
		"scenarioOutline": ["시나리오 개요"],
		"then": ["그러면 "],
		"when": ["만일 ", "만약 "]
	},
	lt: {
		"and": ["* ", "Ir "],
		"background": ["Kontekstas"],
		"but": ["Bet "],
		"examples": [
			"Pavyzdžiai",
			"Scenarijai",
			"Variantai"
		],
		"feature": ["Savybė"],
		"given": ["Duota "],
		"name": "Lithuanian",
		"native": "lietuvių kalba",
		"rule": ["Rule"],
		"scenario": ["Pavyzdys", "Scenarijus"],
		"scenarioOutline": ["Scenarijaus šablonas"],
		"then": ["Tada "],
		"when": ["Kai "]
	},
	lu: {
		"and": [
			"* ",
			"an ",
			"a "
		],
		"background": ["Hannergrond"],
		"but": ["awer ", "mä "],
		"examples": ["Beispiller"],
		"feature": ["Funktionalitéit"],
		"given": ["ugeholl "],
		"name": "Luxemburgish",
		"native": "Lëtzebuergesch",
		"rule": ["Rule"],
		"scenario": ["Beispill", "Szenario"],
		"scenarioOutline": ["Plang vum Szenario"],
		"then": ["dann "],
		"when": ["wann "]
	},
	lv: {
		"and": ["* ", "Un "],
		"background": ["Konteksts", "Situācija"],
		"but": ["Bet "],
		"examples": ["Piemēri", "Paraugs"],
		"feature": ["Funkcionalitāte", "Fīča"],
		"given": ["Kad "],
		"name": "Latvian",
		"native": "latviešu",
		"rule": ["Rule"],
		"scenario": ["Piemērs", "Scenārijs"],
		"scenarioOutline": ["Scenārijs pēc parauga"],
		"then": ["Tad "],
		"when": ["Ja "]
	},
	"mk-Cyrl": {
		"and": ["* ", "И "],
		"background": ["Контекст", "Содржина"],
		"but": ["Но "],
		"examples": ["Примери", "Сценарија"],
		"feature": [
			"Функционалност",
			"Бизнис потреба",
			"Можност"
		],
		"given": ["Дадено ", "Дадена "],
		"name": "Macedonian",
		"native": "Македонски",
		"rule": ["Rule"],
		"scenario": [
			"Пример",
			"Сценарио",
			"На пример"
		],
		"scenarioOutline": [
			"Преглед на сценарија",
			"Скица",
			"Концепт"
		],
		"then": ["Тогаш "],
		"when": ["Кога "]
	},
	"mk-Latn": {
		"and": ["* ", "I "],
		"background": ["Kontekst", "Sodrzhina"],
		"but": ["No "],
		"examples": ["Primeri", "Scenaria"],
		"feature": [
			"Funkcionalnost",
			"Biznis potreba",
			"Mozhnost"
		],
		"given": ["Dadeno ", "Dadena "],
		"name": "Macedonian (Latin)",
		"native": "Makedonski (Latinica)",
		"rule": ["Rule"],
		"scenario": ["Scenario", "Na primer"],
		"scenarioOutline": [
			"Pregled na scenarija",
			"Skica",
			"Koncept"
		],
		"then": ["Togash "],
		"when": ["Koga "]
	},
	mn: {
		"and": [
			"* ",
			"Мөн ",
			"Тэгээд "
		],
		"background": ["Агуулга"],
		"but": ["Гэхдээ ", "Харин "],
		"examples": ["Тухайлбал"],
		"feature": ["Функц", "Функционал"],
		"given": ["Өгөгдсөн нь ", "Анх "],
		"name": "Mongolian",
		"native": "монгол",
		"rule": ["Rule"],
		"scenario": ["Сценар"],
		"scenarioOutline": ["Сценарын төлөвлөгөө"],
		"then": ["Тэгэхэд ", "Үүний дараа "],
		"when": ["Хэрэв "]
	},
	ne: {
		"and": [
			"* ",
			"र ",
			"अनि "
		],
		"background": ["पृष्ठभूमी"],
		"but": ["तर "],
		"examples": ["उदाहरण", "उदाहरणहरु"],
		"feature": ["सुविधा", "विशेषता"],
		"given": [
			"दिइएको ",
			"दिएको ",
			"यदि "
		],
		"name": "Nepali",
		"native": "नेपाली",
		"rule": ["नियम"],
		"scenario": ["परिदृश्य"],
		"scenarioOutline": ["परिदृश्य रूपरेखा"],
		"then": ["त्यसपछि ", "अनी "],
		"when": ["जब "]
	},
	nl: {
		"and": ["* ", "En "],
		"background": ["Achtergrond"],
		"but": ["Maar "],
		"examples": ["Voorbeelden"],
		"feature": ["Functionaliteit"],
		"given": ["Gegeven ", "Stel "],
		"name": "Dutch",
		"native": "Nederlands",
		"rule": ["Regel"],
		"scenario": ["Voorbeeld", "Scenario"],
		"scenarioOutline": ["Abstract Scenario"],
		"then": ["Dan "],
		"when": ["Als ", "Wanneer "]
	},
	no: {
		"and": ["* ", "Og "],
		"background": ["Bakgrunn"],
		"but": ["Men "],
		"examples": ["Eksempler"],
		"feature": ["Egenskap"],
		"given": ["Gitt "],
		"name": "Norwegian",
		"native": "norsk",
		"rule": ["Regel"],
		"scenario": ["Eksempel", "Scenario"],
		"scenarioOutline": ["Scenariomal", "Abstrakt Scenario"],
		"then": ["Så "],
		"when": ["Når "]
	},
	pa: {
		"and": ["* ", "ਅਤੇ "],
		"background": ["ਪਿਛੋਕੜ"],
		"but": ["ਪਰ "],
		"examples": ["ਉਦਾਹਰਨਾਂ"],
		"feature": [
			"ਖਾਸੀਅਤ",
			"ਮੁਹਾਂਦਰਾ",
			"ਨਕਸ਼ ਨੁਹਾਰ"
		],
		"given": ["ਜੇਕਰ ", "ਜਿਵੇਂ ਕਿ "],
		"name": "Panjabi",
		"native": "ਪੰਜਾਬੀ",
		"rule": ["Rule"],
		"scenario": ["ਉਦਾਹਰਨ", "ਪਟਕਥਾ"],
		"scenarioOutline": ["ਪਟਕਥਾ ਢਾਂਚਾ", "ਪਟਕਥਾ ਰੂਪ ਰੇਖਾ"],
		"then": ["ਤਦ "],
		"when": ["ਜਦੋਂ "]
	},
	pl: {
		"and": [
			"* ",
			"Oraz ",
			"I "
		],
		"background": ["Założenia"],
		"but": ["Ale "],
		"examples": ["Przykłady"],
		"feature": [
			"Właściwość",
			"Funkcja",
			"Aspekt",
			"Potrzeba biznesowa"
		],
		"given": [
			"Zakładając ",
			"Mając ",
			"Zakładając, że "
		],
		"name": "Polish",
		"native": "polski",
		"rule": ["Zasada", "Reguła"],
		"scenario": ["Przykład", "Scenariusz"],
		"scenarioOutline": ["Szablon scenariusza"],
		"then": ["Wtedy "],
		"when": [
			"Jeżeli ",
			"Jeśli ",
			"Gdy ",
			"Kiedy "
		]
	},
	pt: {
		"and": ["* ", "E "],
		"background": [
			"Contexto",
			"Cenário de Fundo",
			"Cenario de Fundo",
			"Fundo"
		],
		"but": ["Mas "],
		"examples": [
			"Exemplos",
			"Cenários",
			"Cenarios"
		],
		"feature": [
			"Funcionalidade",
			"Característica",
			"Caracteristica"
		],
		"given": [
			"Dado ",
			"Dada ",
			"Dados ",
			"Dadas "
		],
		"name": "Portuguese",
		"native": "português",
		"rule": ["Regra"],
		"scenario": [
			"Exemplo",
			"Cenário",
			"Cenario"
		],
		"scenarioOutline": [
			"Esquema do Cenário",
			"Esquema do Cenario",
			"Delineação do Cenário",
			"Delineacao do Cenario"
		],
		"then": ["Então ", "Entao "],
		"when": ["Quando "]
	},
	ro: {
		"and": [
			"* ",
			"Si ",
			"Și ",
			"Şi "
		],
		"background": ["Context"],
		"but": ["Dar "],
		"examples": ["Exemple"],
		"feature": [
			"Functionalitate",
			"Funcționalitate",
			"Funcţionalitate"
		],
		"given": [
			"Date fiind ",
			"Dat fiind ",
			"Dată fiind",
			"Dati fiind ",
			"Dați fiind ",
			"Daţi fiind "
		],
		"name": "Romanian",
		"native": "română",
		"rule": ["Rule"],
		"scenario": ["Exemplu", "Scenariu"],
		"scenarioOutline": ["Structura scenariu", "Structură scenariu"],
		"then": ["Atunci "],
		"when": ["Cand ", "Când "]
	},
	ru: {
		"and": [
			"* ",
			"И ",
			"К тому же ",
			"Также "
		],
		"background": ["Предыстория", "Контекст"],
		"but": [
			"Но ",
			"А ",
			"Иначе "
		],
		"examples": ["Примеры"],
		"feature": [
			"Функция",
			"Функциональность",
			"Функционал",
			"Свойство",
			"Фича"
		],
		"given": [
			"Допустим ",
			"Дано ",
			"Пусть "
		],
		"name": "Russian",
		"native": "русский",
		"rule": ["Правило"],
		"scenario": ["Пример", "Сценарий"],
		"scenarioOutline": ["Структура сценария", "Шаблон сценария"],
		"then": [
			"То ",
			"Затем ",
			"Тогда "
		],
		"when": ["Когда ", "Если "]
	},
	sk: {
		"and": [
			"* ",
			"A ",
			"A tiež ",
			"A taktiež ",
			"A zároveň "
		],
		"background": ["Pozadie"],
		"but": ["Ale "],
		"examples": ["Príklady"],
		"feature": [
			"Požiadavka",
			"Funkcia",
			"Vlastnosť"
		],
		"given": ["Pokiaľ ", "Za predpokladu "],
		"name": "Slovak",
		"native": "Slovensky",
		"rule": ["Rule"],
		"scenario": ["Príklad", "Scenár"],
		"scenarioOutline": [
			"Náčrt Scenáru",
			"Náčrt Scenára",
			"Osnova Scenára"
		],
		"then": ["Tak ", "Potom "],
		"when": ["Keď ", "Ak "]
	},
	sl: {
		"and": ["In ", "Ter "],
		"background": [
			"Kontekst",
			"Osnova",
			"Ozadje"
		],
		"but": [
			"Toda ",
			"Ampak ",
			"Vendar "
		],
		"examples": ["Primeri", "Scenariji"],
		"feature": [
			"Funkcionalnost",
			"Funkcija",
			"Možnosti",
			"Moznosti",
			"Lastnost",
			"Značilnost"
		],
		"given": [
			"Dano ",
			"Podano ",
			"Zaradi ",
			"Privzeto "
		],
		"name": "Slovenian",
		"native": "Slovenski",
		"rule": ["Rule"],
		"scenario": ["Primer", "Scenarij"],
		"scenarioOutline": [
			"Struktura scenarija",
			"Skica",
			"Koncept",
			"Oris scenarija",
			"Osnutek"
		],
		"then": [
			"Nato ",
			"Potem ",
			"Takrat "
		],
		"when": [
			"Ko ",
			"Ce ",
			"Če ",
			"Kadar "
		]
	},
	"sr-Cyrl": {
		"and": ["* ", "И "],
		"background": [
			"Контекст",
			"Основа",
			"Позадина"
		],
		"but": ["Али "],
		"examples": ["Примери", "Сценарији"],
		"feature": [
			"Функционалност",
			"Могућност",
			"Особина"
		],
		"given": [
			"За дато ",
			"За дате ",
			"За дати "
		],
		"name": "Serbian",
		"native": "Српски",
		"rule": ["Правило"],
		"scenario": ["Сценарио", "Пример"],
		"scenarioOutline": [
			"Структура сценарија",
			"Скица",
			"Концепт"
		],
		"then": ["Онда "],
		"when": ["Када ", "Кад "]
	},
	"sr-Latn": {
		"and": ["* ", "I "],
		"background": [
			"Kontekst",
			"Osnova",
			"Pozadina"
		],
		"but": ["Ali "],
		"examples": ["Primeri", "Scenariji"],
		"feature": [
			"Funkcionalnost",
			"Mogućnost",
			"Mogucnost",
			"Osobina"
		],
		"given": [
			"Za dato ",
			"Za date ",
			"Za dati "
		],
		"name": "Serbian (Latin)",
		"native": "Srpski (Latinica)",
		"rule": ["Pravilo"],
		"scenario": ["Scenario", "Primer"],
		"scenarioOutline": [
			"Struktura scenarija",
			"Skica",
			"Koncept"
		],
		"then": ["Onda "],
		"when": ["Kada ", "Kad "]
	},
	sv: {
		"and": ["* ", "Och "],
		"background": ["Bakgrund"],
		"but": ["Men "],
		"examples": ["Exempel"],
		"feature": ["Egenskap"],
		"given": ["Givet "],
		"name": "Swedish",
		"native": "Svenska",
		"rule": ["Regel"],
		"scenario": ["Scenario"],
		"scenarioOutline": ["Abstrakt Scenario", "Scenariomall"],
		"then": ["Så "],
		"when": ["När "]
	},
	ta: {
		"and": [
			"* ",
			"மேலும் ",
			"மற்றும் "
		],
		"background": ["பின்னணி"],
		"but": ["ஆனால் "],
		"examples": [
			"எடுத்துக்காட்டுகள்",
			"காட்சிகள்",
			"நிலைமைகளில்"
		],
		"feature": [
			"அம்சம்",
			"வணிக தேவை",
			"திறன்"
		],
		"given": ["கொடுக்கப்பட்ட "],
		"name": "Tamil",
		"native": "தமிழ்",
		"rule": ["Rule"],
		"scenario": ["உதாரணமாக", "காட்சி"],
		"scenarioOutline": ["காட்சி சுருக்கம்", "காட்சி வார்ப்புரு"],
		"then": ["அப்பொழுது "],
		"when": ["எப்போது "]
	},
	th: {
		"and": ["* ", "และ "],
		"background": ["แนวคิด"],
		"but": ["แต่ "],
		"examples": ["ชุดของตัวอย่าง", "ชุดของเหตุการณ์"],
		"feature": [
			"โครงหลัก",
			"ความต้องการทางธุรกิจ",
			"ความสามารถ"
		],
		"given": ["กำหนดให้ "],
		"name": "Thai",
		"native": "ไทย",
		"rule": ["Rule"],
		"scenario": ["เหตุการณ์"],
		"scenarioOutline": ["สรุปเหตุการณ์", "โครงสร้างของเหตุการณ์"],
		"then": ["ดังนั้น "],
		"when": ["เมื่อ "]
	},
	te: {
		"and": ["* ", "మరియు "],
		"background": ["నేపథ్యం"],
		"but": ["కాని "],
		"examples": ["ఉదాహరణలు"],
		"feature": ["గుణము"],
		"given": ["చెప్పబడినది "],
		"name": "Telugu",
		"native": "తెలుగు",
		"rule": ["Rule"],
		"scenario": ["ఉదాహరణ", "సన్నివేశం"],
		"scenarioOutline": ["కథనం"],
		"then": ["అప్పుడు "],
		"when": ["ఈ పరిస్థితిలో "]
	},
	tlh: {
		"and": [
			"* ",
			"'ej ",
			"latlh "
		],
		"background": ["mo'"],
		"but": ["'ach ", "'a "],
		"examples": ["ghantoH", "lutmey"],
		"feature": [
			"Qap",
			"Qu'meH 'ut",
			"perbogh",
			"poQbogh malja'",
			"laH"
		],
		"given": ["ghu' noblu' ", "DaH ghu' bejlu' "],
		"name": "Klingon",
		"native": "tlhIngan",
		"rule": ["Rule"],
		"scenario": ["lut"],
		"scenarioOutline": ["lut chovnatlh"],
		"then": ["vaj "],
		"when": ["qaSDI' "]
	},
	tr: {
		"and": ["* ", "Ve "],
		"background": ["Geçmiş"],
		"but": ["Fakat ", "Ama "],
		"examples": ["Örnekler"],
		"feature": ["Özellik"],
		"given": ["Diyelim ki "],
		"name": "Turkish",
		"native": "Türkçe",
		"rule": ["Kural"],
		"scenario": ["Örnek", "Senaryo"],
		"scenarioOutline": ["Senaryo taslağı"],
		"then": ["O zaman "],
		"when": ["Eğer ki "]
	},
	tt: {
		"and": [
			"* ",
			"Һәм ",
			"Вә "
		],
		"background": ["Кереш"],
		"but": ["Ләкин ", "Әмма "],
		"examples": ["Үрнәкләр", "Мисаллар"],
		"feature": ["Мөмкинлек", "Үзенчәлеклелек"],
		"given": ["Әйтик "],
		"name": "Tatar",
		"native": "Татарча",
		"rule": ["Rule"],
		"scenario": ["Сценарий"],
		"scenarioOutline": ["Сценарийның төзелеше"],
		"then": ["Нәтиҗәдә "],
		"when": ["Әгәр "]
	},
	uk: {
		"and": [
			"* ",
			"І ",
			"А також ",
			"Та "
		],
		"background": ["Передумова"],
		"but": ["Але "],
		"examples": ["Приклади"],
		"feature": ["Функціонал"],
		"given": [
			"Припустимо ",
			"Припустимо, що ",
			"Нехай ",
			"Дано "
		],
		"name": "Ukrainian",
		"native": "Українська",
		"rule": ["Rule"],
		"scenario": ["Приклад", "Сценарій"],
		"scenarioOutline": ["Структура сценарію"],
		"then": ["То ", "Тоді "],
		"when": ["Якщо ", "Коли "]
	},
	ur: {
		"and": ["* ", "اور "],
		"background": ["پس منظر"],
		"but": ["لیکن "],
		"examples": ["مثالیں"],
		"feature": [
			"صلاحیت",
			"کاروبار کی ضرورت",
			"خصوصیت"
		],
		"given": [
			"اگر ",
			"بالفرض ",
			"فرض کیا "
		],
		"name": "Urdu",
		"native": "اردو",
		"rule": ["Rule"],
		"scenario": ["منظرنامہ"],
		"scenarioOutline": ["منظر نامے کا خاکہ"],
		"then": ["پھر ", "تب "],
		"when": ["جب "]
	},
	uz: {
		"and": ["* ", "Ва "],
		"background": ["Тарих"],
		"but": [
			"Лекин ",
			"Бирок ",
			"Аммо "
		],
		"examples": ["Мисоллар"],
		"feature": ["Функционал"],
		"given": ["Belgilangan "],
		"name": "Uzbek",
		"native": "Узбекча",
		"rule": ["Rule"],
		"scenario": ["Сценарий"],
		"scenarioOutline": ["Сценарий структураси"],
		"then": ["Унда "],
		"when": ["Агар "]
	},
	vi: {
		"and": ["* ", "Và "],
		"background": ["Bối cảnh"],
		"but": ["Nhưng "],
		"examples": ["Dữ liệu"],
		"feature": ["Tính năng"],
		"given": ["Biết ", "Cho "],
		"name": "Vietnamese",
		"native": "Tiếng Việt",
		"rule": ["Quy tắc"],
		"scenario": ["Tình huống", "Kịch bản"],
		"scenarioOutline": ["Khung tình huống", "Khung kịch bản"],
		"then": ["Thì "],
		"when": ["Khi "]
	},
	"zh-CN": {
		"and": [
			"* ",
			"而且",
			"并且",
			"同时"
		],
		"background": ["背景"],
		"but": ["但是"],
		"examples": ["例子"],
		"feature": ["功能"],
		"given": [
			"假如",
			"假设",
			"假定"
		],
		"name": "Chinese simplified",
		"native": "简体中文",
		"rule": ["Rule", "规则"],
		"scenario": ["场景", "剧本"],
		"scenarioOutline": ["场景大纲", "剧本大纲"],
		"then": ["那么"],
		"when": ["当"]
	},
	ml: {
		"and": ["* ", "ഒപ്പം"],
		"background": ["പശ്ചാത്തലം"],
		"but": ["പക്ഷേ"],
		"examples": ["ഉദാഹരണങ്ങൾ"],
		"feature": ["സവിശേഷത"],
		"given": ["നൽകിയത്"],
		"name": "Malayalam",
		"native": "മലയാളം",
		"rule": ["നിയമം"],
		"scenario": ["രംഗം"],
		"scenarioOutline": ["സാഹചര്യത്തിന്റെ രൂപരേഖ"],
		"then": ["പിന്നെ"],
		"when": ["എപ്പോൾ"]
	},
	"zh-TW": {
		"and": [
			"* ",
			"而且",
			"並且",
			"同時"
		],
		"background": ["背景"],
		"but": ["但是"],
		"examples": ["例子"],
		"feature": ["功能"],
		"given": [
			"假如",
			"假設",
			"假定"
		],
		"name": "Chinese traditional",
		"native": "繁體中文",
		"rule": ["Rule"],
		"scenario": ["場景", "劇本"],
		"scenarioOutline": ["場景大綱", "劇本大綱"],
		"then": ["那麼"],
		"when": ["當"]
	},
	mr: {
		"and": [
			"* ",
			"आणि ",
			"तसेच "
		],
		"background": ["पार्श्वभूमी"],
		"but": ["पण ", "परंतु "],
		"examples": ["उदाहरण"],
		"feature": ["वैशिष्ट्य", "सुविधा"],
		"given": ["जर", "दिलेल्या प्रमाणे "],
		"name": "Marathi",
		"native": "मराठी",
		"rule": ["नियम"],
		"scenario": ["परिदृश्य"],
		"scenarioOutline": ["परिदृश्य रूपरेखा"],
		"then": ["मग ", "तेव्हा "],
		"when": ["जेव्हा "]
	},
	amh: {
		"and": ["* ", "እና "],
		"background": [
			"ቅድመ ሁኔታ",
			"መነሻ",
			"መነሻ ሀሳብ"
		],
		"but": ["ግን "],
		"examples": ["ምሳሌዎች", "ሁናቴዎች"],
		"feature": [
			"ስራ",
			"የተፈለገው ስራ",
			"የሚፈለገው ድርጊት"
		],
		"given": ["የተሰጠ "],
		"name": "Amharic",
		"native": "አማርኛ",
		"rule": ["ህግ"],
		"scenario": ["ምሳሌ", "ሁናቴ"],
		"scenarioOutline": ["ሁናቴ ዝርዝር", "ሁናቴ አብነት"],
		"then": ["ከዚያ "],
		"when": ["መቼ "]
	}
};
//#endregion
//#region src/parser/lang/SpokenParser.ts
var SpokenParserFactory = class {
	static fromLang(lang) {
		return new SpokenParser(lang in lang_default ? lang_default[lang] : en);
	}
};
var SpokenParser = class {
	details;
	constructor(details) {
		this.details = details;
	}
	getFeatureName(line) {
		return this.getMatchKey({
			line,
			keys: this.details.feature,
			titleRequired: true
		});
	}
	getScenarioName(line) {
		return this.getMatchKey({
			line,
			keys: this.details.scenario,
			titleRequired: true
		});
	}
	getScenarioOutlineName(line) {
		return this.getMatchKey({
			line,
			keys: this.details.scenarioOutline,
			titleRequired: true
		});
	}
	getRuleName(line) {
		return this.getMatchKey({
			line,
			keys: this.details.rule,
			titleRequired: true
		});
	}
	getBackgroundKeyWord(line) {
		return this.getMatchKey({
			line,
			keys: this.details.background
		}).keyword;
	}
	getMatchKey(options) {
		const foundKeyword = options.keys.find((featureKey) => options.line.trim().startsWith(`${featureKey}:`));
		if (!foundKeyword) throw new SpokenKeywordError(options.line, options.keys);
		const title = options.line.split(`${foundKeyword}:`).at(1)?.trim();
		if (!title && options.titleRequired) throw new RequiredTitleError(options.line.trim(), foundKeyword);
		return {
			keyword: foundKeyword.trim(),
			title: title || ""
		};
	}
	isRule(line) {
		return this.lineStartsWithOneOf(this.details.rule, line);
	}
	isExamples(line) {
		return this.lineStartsWithOneOf(this.details.examples, line);
	}
	isFeature(line) {
		return this.lineStartsWithOneOf(this.details.feature, line);
	}
	isScenarioOutline(line) {
		return this.lineStartsWithOneOf(this.details.scenarioOutline, line);
	}
	isScenario(line) {
		return this.lineStartsWithOneOf(this.details.scenario, line);
	}
	isBackground(line) {
		return this.lineStartsWithOneOf(this.details.background, line);
	}
	isStep(line) {
		return this.foundStep(line) !== void 0;
	}
	getStepDetails(line, type) {
		const matches = this.stepsMatch.find((s) => s.type === type);
		const foundMatch = matches?.keys.find((stepKey) => {
			return line.trim().startsWith(stepKey);
		});
		if (foundMatch) return {
			keyword: foundMatch.trim(),
			title: line.trim().split(foundMatch)[1].trim()
		};
		throw new SpokenKeywordError(line, matches?.keys || []);
	}
	getStepType(line) {
		const foundStep = this.foundStep(line);
		if (foundStep) return foundStep.type;
		throw new Error("Type not found");
	}
	foundStep(line) {
		return this.stepsMatch.find((stepDetails) => {
			return stepDetails.keys.some((stepKey) => {
				return line.trim().startsWith(stepKey);
			});
		});
	}
	lineStartsWithOneOf(keys, line) {
		return keys.find((value) => {
			return line.trim().startsWith(`${value}:`);
		}) !== void 0;
	}
	get stepsMatch() {
		return [
			{
				type: "Given",
				keys: this.details.given
			},
			{
				type: "When",
				keys: this.details.when
			},
			{
				type: "Then",
				keys: this.details.then
			},
			{
				type: "And",
				keys: this.details.and
			},
			{
				type: "But",
				keys: this.details.but
			}
		];
	}
};
//#endregion
//#region src/parser/expression/symbolToCode.json
var symbolToCode_default = {
	$: "USD",
	$CAD: "CAD",
	$U: "UYU",
	A$: "AUD",
	AED: "AED",
	ALL: "ALL",
	AMD: "AMD",
	AR$: "ARS",
	AU$: "AUD",
	Af: "AFN",
	"B/.": "PAB",
	BD: "BHD",
	BGN: "BGN",
	BN$: "BND",
	BWP: "BWP",
	BZ$: "BZD",
	Bs: "BOB",
	"Bs.F.": "VEF",
	C$: "NIO",
	CA$: "CAD",
	CDF: "CDF",
	CF: "KMF",
	CFA: "XOF",
	CFPF: "XPF",
	CHF: "CHF",
	CL$: "CLP",
	"CN¥": "CNY",
	CO$: "COP",
	CV$: "CVE",
	DA: "DZD",
	DT: "TND",
	Dkr: "DKK",
	EGP: "EGP",
	Ekr: "EEK",
	FBu: "BIF",
	FCFA: "XAF",
	FG: "GNF",
	FJ$: "FJD",
	Fdj: "DJF",
	Ft: "HUF",
	GEL: "GEL",
	"GH₵": "GHS",
	GTQ: "GTQ",
	HK$: "HKD",
	HNL: "HNL",
	IQD: "IQD",
	IRR: "IRR",
	Ikr: "ISK",
	J$: "JMD",
	JD: "JOD",
	"JP¥": "JPY",
	KD: "KWD",
	KHR: "KHR",
	KM: "BAM",
	KZT: "KZT",
	Ksh: "KES",
	Kč: "CZK",
	L: "SZL",
	"LB£": "LBP",
	LD: "LYD",
	Ls: "LVL",
	Lt: "LTL",
	MAD: "MAD",
	MDL: "MDL",
	MGA: "MGA",
	MKD: "MKD",
	MMK: "MMK",
	MOP$: "MOP",
	MTn: "MZN",
	MURs: "MUR",
	MX$: "MXN",
	N$: "NAD",
	NPRs: "NPR",
	NT$: "TWD",
	NZ$: "NZD",
	Nfk: "ERN",
	Nkr: "NOK",
	OMR: "OMR",
	PKRs: "PKR",
	QR: "QAR",
	R: "ZAR",
	R$: "BRL",
	RD$: "DOP",
	RM: "MYR",
	RON: "RON",
	RUB: "RUB",
	RWF: "RWF",
	Rp: "IDR",
	Rs: "INR",
	S$: "SGD",
	"S/.": "PEN",
	SDG: "SDG",
	SLRs: "LKR",
	SR: "SAR",
	"SY£": "SYP",
	Skr: "SEK",
	Ssh: "SOS",
	T$: "TOP",
	TL: "TRY",
	TSh: "TZS",
	TT$: "TTD",
	Tk: "BDT",
	US$: "USD",
	USh: "UGX",
	UZS: "UZS",
	VT: "VUV",
	YR: "YER",
	ZK: "ZMW",
	ZWL$: "ZWL",
	"din.": "RSD",
	kn: "HRK",
	"man.": "AZN",
	zł: "PLN",
	"£": "GBP",
	"¥": "JPY",
	"฿": "THB",
	"₡": "CRC",
	"₣": "XPF",
	"₦": "NGN",
	"₩": "KRW",
	"₪": "ILS",
	"₫": "VND",
	"€": "EUR",
	"₱": "PHP",
	"₲": "PYG",
	"₴": "UAH",
	"₹": "INR"
};
//#endregion
//#region src/parser/expression/regexes.ts
var ExpressionRegex = class {
	keyword;
	keywordRegex;
	groupName;
	constructor(options) {
		this.keyword = options.keyword;
		this.keywordRegex = options.keywordRegex;
		this.groupName = options.groupName;
	}
	matchGroupName(str) {
		return str.startsWith(this.groupName);
	}
	get cloneKeywordRegex() {
		return new RegExp(this.keywordRegex.source, this.keywordRegex.flags);
	}
	resetExpressionStates() {}
};
var BooleanRegex = class extends ExpressionRegex {
	constructor() {
		super({
			keyword: `{boolean}`,
			groupName: `boolean`,
			keywordRegex: /{boolean}/g
		});
	}
	getRegex(index) {
		return `\\b(?<boolean${index}>(true|false))\\b`;
	}
	getValue(str) {
		return str === "true";
	}
};
var WordRegex = class extends ExpressionRegex {
	constructor() {
		super({
			keyword: `{word}`,
			groupName: `word`,
			keywordRegex: /{word}/g
		});
	}
	getRegex(index) {
		return `\\b(?<word${index}>\\w+)\\b`;
	}
	getValue(str) {
		return str;
	}
};
var CharRegex = class extends ExpressionRegex {
	constructor() {
		super({
			keyword: `{char}`,
			groupName: `char`,
			keywordRegex: /{char}/g
		});
	}
	getRegex(index) {
		return `(?<char${index}>\\w)`;
	}
	getValue(str) {
		return str;
	}
};
var StringRegex = class extends ExpressionRegex {
	constructor() {
		super({
			keyword: `{string}`,
			groupName: `string`,
			keywordRegex: /{string}/g
		});
	}
	getRegex(index) {
		return `(?<string${index}>"[^"]*"|'[^']*')`;
	}
	getValue(str) {
		return str.replace(/^["']|["']$/g, ``);
	}
};
var EmailRegex = class extends ExpressionRegex {
	constructor() {
		super({
			keyword: `{email}`,
			groupName: `email`,
			keywordRegex: /{email}/g
		});
	}
	getRegex(index) {
		return `\\b(?<email${index}>[^\\s@]+@[^\\s@]+\\.[^\\s@]+)\\b`;
	}
	getValue(str) {
		return str.replace(/^["']|["']$/g, ``);
	}
};
var UrlRegex = class extends ExpressionRegex {
	constructor() {
		super({
			keyword: `{url}`,
			groupName: `url`,
			keywordRegex: /{url}/g
		});
	}
	getRegex(index) {
		return `\\b(?<url${index}>(https?://)?([^\\s\$.?#].[^\\s]*))\\b`;
	}
	getValue(str) {
		try {
			return new URL(str);
		} catch {
			throw new InvalidUrlParameterError(str);
		}
	}
};
var IntRegex = class extends ExpressionRegex {
	constructor() {
		super({
			keyword: `{int}`,
			groupName: `int`,
			keywordRegex: /{int}/g
		});
	}
	getRegex(index) {
		return `(?<int${index}>-?\\d+)`;
	}
	getValue(str) {
		return Number(str);
	}
};
var NumberRegex = class extends ExpressionRegex {
	constructor() {
		super({
			keyword: `{number}`,
			groupName: `number`,
			keywordRegex: /{number}/g
		});
	}
	getRegex(index) {
		return `(?<number${index}>-?\\d+(\\.\\d+)?)`;
	}
	getValue(str) {
		return Number(str);
	}
};
var DateRegex = class extends ExpressionRegex {
	constructor() {
		super({
			keyword: `{date}`,
			groupName: `date`,
			keywordRegex: /{date}/g
		});
	}
	getRegex(index) {
		const dateRegex = `[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}(?: [0-9]{2}:[0-9]{2}:[0-9]{2})?`;
		const isoDateRegex = `(?:\\d{4})-(?:\\d{2})-(?:\\d{2})`;
		const isoDatetimeRegex = `(?:\\d{4})-(?:\\d{2})-(?:\\d{2})T(?:\\d{2}):(?:\\d{2}):(?:\\d{2}(?:\\.\\d*)?)(?:(?:[-|+](?:\\d{2}):(?:\\d{2})|Z)?)`;
		const shortOrLongMonthsRegex = [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Oct",
			"Nov",
			"Dec"
		].concat([
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December"
		]).join("|");
		return `\\b(?<date${index}>(${dateRegex})|(${isoDateRegex})|(${isoDatetimeRegex})|(${`\\d{1,2},? (:?${shortOrLongMonthsRegex}),? \\d{4}`})|(${`(:?${shortOrLongMonthsRegex}),? \\d{1,2},? \\d{4}`}))\\b`;
	}
	getValue(str) {
		const value = new Date(str);
		if (Number.isNaN(value.getTime())) throw new InvalidDateParameterError(str);
		return value;
	}
};
var CurrencyRegex = class extends ExpressionRegex {
	constructor() {
		super({
			keyword: `{currency}`,
			groupName: `currency`,
			keywordRegex: /{currency}/g
		});
	}
	getRegex(index) {
		return `(?<!\\S)(?<currency${index}>((?:([-+]{1}) ?)?(?:([A-Z]{3}) ?)?(?:([^\\d ]+?) ?)?(((?:\\d{1,3}([,. ’'\\u00A0\\u202F]))*?\\d{1,})(([,.])\\d{1,2})?)(?: ?([^\\d]+?))??(?: ?([A-Z]{3}))?))(?!\\S)`;
	}
	getValue(str) {
		const value = parsecurrency(str);
		if (!value) throw new InvalidCurrencyParameterError(str);
		return {
			raw: value.raw,
			value: value.value,
			currency: value.currency || symbolToCode_default[value.symbol]
		};
	}
};
var ListRegex = class extends ExpressionRegex {
	constructor() {
		super({
			keyword: `{list}`,
			groupName: `list`,
			keywordRegex: /{list(?::(["'])([^"']?)\1)?\}/g
		});
	}
	regexMatchSeparators = [];
	resetExpressionStates() {
		this.regexMatchSeparators = [];
	}
	getRegex(index, originalRegex) {
		const s = this.cloneKeywordRegex.exec(originalRegex)?.at(2) || ",";
		this.regexMatchSeparators.push(s);
		return `(?<list${index}>[a-zA-Z]+(?:${s} ?[a-zA-Z]+)*)`;
	}
	getValue(str, index) {
		return str.split(this.regexMatchSeparators[index]).map((t) => t.trim());
	}
};
var AnyRegex = class extends ExpressionRegex {
	constructor() {
		super({
			keyword: `{any}`,
			groupName: `any`,
			keywordRegex: /{any}/g
		});
	}
	getRegex(index) {
		return `(?<any${index}>.+)`;
	}
	getValue(str) {
		return str;
	}
};
//#endregion
//#region src/parser/expression/custom.ts
const customExpressionRegEx = [];
//#endregion
//#region src/parser/expression/ExpressionStep.ts
const builtInExpressionRegEx = [
	new BooleanRegex(),
	new WordRegex(),
	new CharRegex(),
	new StringRegex(),
	new EmailRegex(),
	new UrlRegex(),
	new IntRegex(),
	new NumberRegex(),
	new DateRegex(),
	new CurrencyRegex(),
	new ListRegex(),
	new AnyRegex()
];
var ExpressionStep = class {
	static matchStep(step, stepExpression) {
		const allExpressionRegEx = builtInExpressionRegEx.concat(customExpressionRegEx);
		let regexString = stepExpression;
		const groupCount = {};
		regexString = regexString.replace(/[?]/g, `\\$&`);
		for (const r of allExpressionRegEx) {
			r.resetExpressionStates();
			groupCount[r.groupName] = 0;
		}
		for (const r of allExpressionRegEx) regexString = regexString.replace(r.keywordRegex, (originalRegex) => {
			groupCount[r.groupName] += 1;
			return r.getRegex(groupCount[r.groupName], originalRegex);
		});
		regexString = `^${regexString}$`;
		const regex = new RegExp(regexString, `g`);
		const allValues = [...step.details.matchAll(regex)].filter((match) => match.groups !== void 0).map((match) => {
			const res = [];
			Object.keys(match.groups).forEach((key, index) => {
				const matchRegex = allExpressionRegEx.find((r) => r.matchGroupName(key));
				if (matchRegex) res.push({
					index,
					value: matchRegex.getValue(match.groups[key], index)
				});
				else res.push({
					index,
					value: new StringRegex().getValue(match.groups[key])
				});
			});
			return res;
		}).flat().filter((t) => t !== void 0).map((r) => r.value);
		if (allExpressionRegEx.some((r) => {
			return stepExpression.includes(r.keyword);
		}) && allValues.length === 0) throw new StepExpressionMatchError(step, stepExpression);
		return allValues;
	}
	static stepContainsRegex(expression) {
		return builtInExpressionRegEx.concat(customExpressionRegEx).some((r) => {
			return expression.includes(r.keyword);
		});
	}
};
//#endregion
//#region src/parser/models/Taggable.ts
const matchFilter = (filterItem, tags) => {
	if (Array.isArray(filterItem)) return filterItem.every((item) => tags.has(item));
	return tags.has(filterItem);
};
var Taggable = class {
	tags = /* @__PURE__ */ new Set();
	/**
	* Simple matching filter mostly following the cucumber expression tag rules,
	* e.g. `[["alpha", "beta"], "vitests", "another"]`
	* will be equivalent to:
	
	* (`@alpha` and `@beta`) or `@vitests` or `@another`
	*/
	matchTags(filterItems) {
		return filterItems.some((filterItem) => matchFilter(filterItem, this.tags));
	}
	shouldBeCalled(options) {
		return (options.includeTags.length <= 0 || this.matchTags(options.includeTags) === true) && this.matchTags(options.excludeTags) === false;
	}
};
//#endregion
//#region src/parser/models/Stepable.ts
var StepAble = class extends Taggable {
	isCalled;
	_steps;
	title;
	constructor(title) {
		super();
		this.title = title;
		this.isCalled = false;
		this._steps = [];
	}
	stepFailedExpressionMatch = {};
	findStepByTypeAndDetails(type, details) {
		this.stepFailedExpressionMatch[details] = 0;
		return this._steps.find((step) => {
			try {
				const sameType = step.type === type;
				const sameDetails = step.details === details;
				if (ExpressionStep.stepContainsRegex(details)) {
					const params = ExpressionStep.matchStep(step, details);
					return sameType && (sameDetails || params.length >= 0);
				}
				return sameType && sameDetails;
			} catch (e) {
				this.stepFailedExpressionMatch[details] += 1;
				return false;
			}
		});
	}
	hasUnCalledSteps() {
		return this.getNoCalledStep() !== void 0;
	}
	getNoCalledStep() {
		return this._steps.find((s) => s.isCalled === false);
	}
	addStep(newStep) {
		if (this._steps.find((step) => {
			return step.getTitle() === newStep.getTitle();
		})) throw new ItemAlreadyExistsError(this, newStep);
		this._steps.push(newStep);
	}
	checkIfStepWasCalled() {
		const step = this.getNoCalledStep();
		if (step) throw new StepAbleStepsNotCalledError(this, step);
	}
	checkIfStepExists(stepType, stepDetails) {
		const foundStep = this.findStepByTypeAndDetails(stepType, stepDetails);
		if (!foundStep) {
			if (this.stepFailedExpressionMatch[stepDetails] === this._steps.length) throw new StepAbleStepExpressionError(this, new Step(stepType, stepDetails));
			throw new StepAbleUnknowStepError(this, new Step(stepType, stepDetails));
		}
		return foundStep;
	}
	get lastStep() {
		return this._steps[this._steps.length - 1];
	}
	get steps() {
		return this._steps;
	}
};
//#endregion
//#region src/parser/models/Background.ts
const BackgroundAllowedSteps = ["Given", "And"];
var Background = class extends StepAble {
	constructor(title = "Background") {
		super(title);
	}
	getTitle() {
		return `${this.title}:`;
	}
	addStep(step) {
		if (BackgroundAllowedSteps.includes(step.type)) super.addStep(step);
		else throw new NotAllowedBackgroundStepTypeError(step.type);
	}
};
//#endregion
//#region src/parser/models/scenario.ts
var Scenario = class extends StepAble {
	description;
	constructor(description, title = "Scenario") {
		super(title);
		this.description = description;
	}
	getTitle() {
		return `${this.title}: ${this.description}`;
	}
};
var ScenarioOutline = class extends Scenario {
	examples = [];
	missingExamplesKeyword = false;
	constructor(description, title = "Scenario Outline") {
		super(description, title);
	}
	getStepTitle(step, example) {
		let stepTitle = step.getTitle();
		const exampleKeys = Object.keys(example);
		for (const key of exampleKeys) stepTitle = stepTitle.replace(`<${key}>`, example[key]);
		return stepTitle;
	}
	getStepDocStrings(step, example) {
		if (step.docStrings) {
			let docStrings = `${step.docStrings}`;
			for (const key in example) docStrings = docStrings.replace(`<${key}>`, example[key]);
			return docStrings;
		}
		return null;
	}
};
//#endregion
//#region src/parser/models/ScenarioParent.ts
var ScenarioParent = class extends Taggable {
	name;
	description = "";
	_scenarii = [];
	background = null;
	title;
	constructor(name, title) {
		super();
		this.name = name;
		this.title = title;
	}
	addScenario(newScenario) {
		if (this._scenarii.find((scenario) => {
			return scenario.getTitle() === newScenario.getTitle();
		})) throw new ItemAlreadyExistsError(this, newScenario);
		this._scenarii.push(newScenario);
	}
	getScenarioByName(name) {
		return this._scenarii.find((s) => {
			return s.description === name;
		});
	}
	getScenarioExample(name) {
		const scenario = this.getScenarioByName(name);
		if (scenario instanceof ScenarioOutline) return scenario.examples;
		return null;
	}
	getFirstNotCalledScenario(options) {
		return this._scenarii.find((scenario) => {
			return scenario.isCalled === false && scenario.shouldBeCalled(options);
		});
	}
	haveAlreadyCalledScenario() {
		return this._scenarii.filter((scenario) => scenario.isCalled === true).length > 0;
	}
	getTitle() {
		return `${this.title}: ${this.name}`;
	}
	checkUncalledScenario(options) {
		const uncalled = this.getFirstNotCalledScenario(options);
		if (uncalled) throw new ScenarioNotCalledError(uncalled);
		return this;
	}
	checkUncalledBackground(options) {
		if (this.background) {
			if (this.background.isCalled === false && (options.includeTags.length <= 0 || this.background.matchTags(options.includeTags) === true) && this.background.matchTags(options.excludeTags) === false) throw new BackgroundNotCalledError(this.background);
		}
		return this;
	}
	getBackground() {
		if (this.background) return this.background;
		throw new BackgroundNotExistsError(this);
	}
	checkIfScenarioExists(scenarioDescription) {
		const foundScenario = this.getScenarioByName(scenarioDescription);
		if (!foundScenario) throw new FeatureUknowScenarioError(this, new Scenario(scenarioDescription));
		return foundScenario;
	}
	scenarioShouldNotBeOutline(scenario) {
		if (scenario instanceof ScenarioOutline) throw new IsScenarioOutlineError(scenario);
	}
	scenarioShouldBeOutline(scenario) {
		if (!(scenario instanceof ScenarioOutline)) throw new NotScenarioOutlineError(scenario);
	}
	getScenario(description) {
		const scenario = this.checkIfScenarioExists(description);
		this.scenarioShouldNotBeOutline(scenario);
		return scenario;
	}
	getScenarioOutline(description) {
		const scenario = this.checkIfScenarioExists(description);
		this.scenarioShouldBeOutline(scenario);
		return scenario;
	}
	mustHaveScenario() {
		if (this._scenarii.length === 0) throw new ParentWithoutScenario(this);
	}
	get hasScenarioOutline() {
		return this._scenarii.some((scenario) => scenario.getTitle().includes("Outline"));
	}
	get hasScenario() {
		return this._scenarii.some((scenario) => scenario.getTitle().includes("Outline") === false);
	}
	get scenarii() {
		return this._scenarii;
	}
};
//#endregion
//#region src/parser/models/Rule.ts
var Rule = class extends ScenarioParent {
	isCalled;
	constructor(name, title = "Rule") {
		super(name, title);
		this.isCalled = false;
	}
};
//#endregion
//#region src/parser/models/feature.ts
var Feature = class extends ScenarioParent {
	_rules;
	withoutGherkin;
	constructor(name, title = "Feature", withoutGherkin = false) {
		super(name, title);
		this._rules = [];
		this.withoutGherkin = withoutGherkin;
	}
	getRuleByName(name) {
		return this._rules.find((rule) => rule.name === name);
	}
	getFirstRuleNotCalled(options) {
		return this._rules.find((rule) => rule.isCalled === false && (options.includeTags.length <= 0 || rule.matchTags(options.includeTags) === true) && rule.matchTags(options.excludeTags) === false);
	}
	haveAlreadyCalledRule() {
		return this._rules.some((rule) => rule.isCalled === true);
	}
	checkUncalledRule(options) {
		const uncalled = this.getFirstRuleNotCalled(options);
		if (uncalled) throw new RuleNotCalledError(uncalled);
		return this;
	}
	checkIfRuleExists(ruleName) {
		const foundRule = this.getRuleByName(ruleName);
		if (!foundRule) throw new FeatureUknowRuleError(this, new Rule(ruleName));
		return foundRule;
	}
	mustHaveScenarioOrRules() {
		if (this._rules.length > 0) for (const rule of this._rules) rule.mustHaveScenario();
		else this.mustHaveScenario();
	}
	addRule(newRule) {
		if (this._rules.find((rule) => {
			return rule.getTitle() === newRule.getTitle();
		})) throw new ItemAlreadyExistsError(this, newRule);
		this._rules.push(newRule);
	}
	get rules() {
		return this._rules;
	}
};
//#endregion
//#region src/parser/parser.ts
var GherkinParser = class {
	spokenParser;
	features = [];
	currentFeatureIndex = -1;
	currentScenarioIndex = -1;
	currentRulenIndex = -1;
	lastScenarioOutline = null;
	currentExample = null;
	currentExampleLine = -1;
	exampleKeys = [];
	currentDataTable = [];
	currentStepDataTableLine = -1;
	dataTanleKeys = [];
	lastTags = [];
	lastSteppableTag = null;
	currentDocStrings = [];
	parsingDocStrings = false;
	previousAction = null;
	lastStep = null;
	descriptionLines = [];
	flushDescription() {
		if (this.descriptionLines.length > 0) {
			const description = this.descriptionLines.join("\n");
			if (this.currentRule) this.currentRule.description = description;
			else if (this.currentFeature) this.currentFeature.description = description;
			this.descriptionLines = [];
		}
	}
	resetStepDataTable() {
		this.currentDataTable = [];
		this.currentStepDataTableLine = -1;
		this.dataTanleKeys = [];
		this.lastStep = null;
	}
	constructor(options) {
		this.spokenParser = SpokenParserFactory.fromLang(options.language);
	}
	hasFeature(line) {
		if (!this.currentFeature) throw new MissingFeature(line);
		return true;
	}
	hasSteppable(line) {
		if (!(this.currentBackground || this.currentScenario)) throw new MissingSteppableError(line);
		return true;
	}
	hasScenarioOutline(line) {
		if (!this.lastScenarioOutline) throw new MissingScnearioOutlineError(line);
		return true;
	}
	previousActionIs(value) {
		return this.previousAction === value;
	}
	addLine(line) {
		if (line.trim().startsWith(`#`)) return;
		if (this.previousActionIs("Step")) {
			if (this.lastStep) this.lastStep.dataTables = this.currentDataTable;
		}
		if (this.parsingDocStrings && !this.isDocStrings(line)) this.currentDocStrings.push(line.trim());
		else if (this.spokenParser.isFeature(line)) {
			this.previousAction = "Feature";
			this.resetStepDataTable();
			if (this.features.length > 0) throw new OnlyOneFeatureError();
			this.currentFeatureIndex++;
			this.currentScenarioIndex = -1;
			this.currentRulenIndex = -1;
			this.currentExampleLine = -1;
			const { title, keyword } = this.spokenParser.getFeatureName(line);
			const feature = new Feature(title, keyword);
			this.features.push(feature);
			this.addTagToParent(feature);
		} else if (this.spokenParser.isRule(line) && this.hasFeature(line)) {
			this.flushDescription();
			this.previousAction = "Rule";
			this.resetStepDataTable();
			this.currentExampleLine = -1;
			this.currentScenarioIndex = -1;
			this.currentRulenIndex++;
			const { title, keyword } = this.spokenParser.getRuleName(line);
			const rule = new Rule(title, keyword);
			this.addTagToParent(rule);
			this.currentFeature.addRule(rule);
		} else if (this.spokenParser.isScenarioOutline(line) && this.hasFeature(line)) {
			this.flushDescription();
			this.previousAction = "Scenario";
			this.resetStepDataTable();
			this.currentScenarioIndex++;
			const { title, keyword } = this.spokenParser.getScenarioOutlineName(line);
			const scenario = new ScenarioOutline(title, keyword);
			this.lastScenarioOutline = scenario;
			this.lastSteppableTag = `ScenarioOutline`;
			this.addScenarioToParent(scenario);
			this.addTagToParent(scenario);
		} else if (this.spokenParser.isExamples(line) && this.hasScenarioOutline(line)) {
			this.previousAction = "Examples";
			this.currentExample = [];
			this.resetStepDataTable();
		} else if (line.trim().startsWith(`|`)) if (this.previousActionIs("Examples") && this.currentExample) {
			this.detectMissingExamplesKeyword();
			this.updateScenarioExamples(line);
		} else if (this.previousActionIs("Step")) this.updateStepDataTable(line);
		else throw new MissingExamplesError(line);
		else if (this.spokenParser.isScenario(line) && this.hasFeature(line)) {
			this.flushDescription();
			this.previousAction = "Scenario";
			this.resetStepDataTable();
			this.currentScenarioIndex++;
			const { title, keyword } = this.spokenParser.getScenarioName(line);
			const scenario = new Scenario(title, keyword);
			this.lastSteppableTag = `Scenario`;
			this.addScenarioToParent(scenario);
			this.addTagToParent(scenario);
		} else if (this.spokenParser.isBackground(line) && this.hasFeature(line)) {
			this.flushDescription();
			this.previousAction = "Background";
			this.resetStepDataTable();
			if (this.currentBackground) throw new TwiceBackgroundError();
			const background = new Background(this.spokenParser.getBackgroundKeyWord(line));
			this.lastSteppableTag = `Background`;
			this.addBackgroundToParent(background);
			this.addTagToParent(background);
		} else if (line.trim().startsWith(`@`)) this.lastTags.push(...line.split(` `).filter((l) => l.startsWith(`@`)).map((l) => l.replace(`@`, ``)));
		else if (this.isDocStrings(line)) if (this.parsingDocStrings) {
			this.currentScenario.lastStep.docStrings = this.currentDocStrings.join(`\n`);
			this.parsingDocStrings = false;
			this.currentDocStrings.splice(0, this.currentDocStrings.length);
		} else this.parsingDocStrings = true;
		else if (!this.parsingDocStrings && this.spokenParser.isStep(line) && this.hasSteppable(line)) {
			this.previousAction = "Step";
			this.resetStepDataTable();
			const stepType = this.spokenParser.getStepType(line);
			const { keyword, title } = this.spokenParser.getStepDetails(line, stepType);
			const newStep = new Step(stepType, title, keyword);
			this.lastStep = newStep;
			this.currentScenario.addStep(newStep);
		} else if (this.currentExample !== null) {
			if (this.currentExample.length === 0) this.currentExample.push(this.getEmptyExamplesValues());
			if (this.lastScenarioOutline) this.lastScenarioOutline.examples = JSON.parse(JSON.stringify(this.currentExample));
			this.currentExample = null;
			this.currentExampleLine = -1;
		} else if ((this.previousAction === "Feature" || this.previousAction === "Rule") && line.trim().length > 0) this.descriptionLines.push(line.trim());
	}
	addBackgroundToParent(background) {
		if (this.currentRule) this.currentRule.background = background;
		else this.currentFeature.background = background;
	}
	addScenarioToParent(scenario) {
		if (this.currentRule) this.currentRule.addScenario(scenario);
		else this.currentFeature.addScenario(scenario);
	}
	finish() {
		this.flushDescription();
		if (this.lastScenarioOutline && this.currentExample) {
			if (this.currentExample.length === 0) this.currentExample.push(this.getEmptyExamplesValues());
			this.lastScenarioOutline.examples = JSON.parse(JSON.stringify(this.currentExample));
		}
		this.currentFeature?.mustHaveScenarioOrRules();
		return this.features;
	}
	getVariablesFromLine(line) {
		return line.trim().split(`|`).filter((n) => n.length > 0).map((n) => n.trim());
	}
	getObjectWithValuesFromLine(line, keys) {
		return this.getVariablesFromLine(line).reduce((acc, cur, index) => {
			return acc[keys[index]] = cur, acc;
		}, {});
	}
	addTagToParent(parent) {
		if (this.lastTags.length > 0) {
			for (const tag of this.lastTags) parent.tags.add(tag);
			this.lastTags = [];
		}
	}
	getEmptyExamplesValues() {
		return this.exampleKeys.reduce((acc, cur, index) => {
			return acc[this.exampleKeys[index]] = null, acc;
		}, {});
	}
	detectMissingExamplesKeyword() {
		if (this.currentExample === null && this.lastScenarioOutline) this.lastScenarioOutline.missingExamplesKeyword = true;
	}
	updateStepDataTable(line) {
		if (this.currentDataTable) {
			this.currentStepDataTableLine++;
			if (this.currentStepDataTableLine === 0) this.dataTanleKeys = this.getVariablesFromLine(line);
			else this.currentDataTable.push(this.getObjectWithValuesFromLine(line, this.dataTanleKeys));
		}
	}
	updateScenarioExamples(line) {
		if (this.currentExample) {
			this.currentExampleLine++;
			if (this.currentExampleLine === 0) this.exampleKeys = this.getVariablesFromLine(line);
			else this.currentExample.push(this.getObjectWithValuesFromLine(line, this.exampleKeys));
		}
	}
	isDocStrings(line) {
		return line.trim().startsWith(`"""`) || line.trim().startsWith(`\`\`\``);
	}
	get currentBackground() {
		if (this.currentRule) return this.currentRule.background;
		return this.currentFeature.background;
	}
	get currentRule() {
		return this.currentFeature.rules[this.currentRulenIndex];
	}
	get currentFeature() {
		return this.features[this.currentFeatureIndex];
	}
	get currentScenario() {
		if (this.lastSteppableTag === `Background` && this.currentBackground) return this.currentBackground;
		if (this.currentRule) return this.currentRule.scenarii[this.currentScenarioIndex];
		return this.currentFeature.scenarii[this.currentScenarioIndex];
	}
};
//#endregion
//#region src/parser/readfile.ts
var FeatureFileReader = class FeatureFileReader {
	path;
	parser;
	callerFileDir;
	static fromPath(params) {
		return new FeatureFileReader(params);
	}
	constructor(params) {
		this.callerFileDir = params.callerFileDir || null;
		this.path = this.handleFeatureFilePath(params.featureFilePath);
		this.parser = new GherkinParser(params.options);
	}
	handleFeatureFilePath(featureFilePath) {
		if (featureFilePath.match(/\.\/[\w-]+(\.[\w-]+)*$/)) return `${this.callerFileDir}/${featureFilePath}`;
		return featureFilePath;
	}
	async parseFile() {
		if (!fs.existsSync(this.path)) throw new FeatureFileNotFoundError(this.path).message;
		let parseFilleError = null;
		const fileStream = fs.createReadStream(this.path);
		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Number.POSITIVE_INFINITY
		});
		rl.on(`line`, (line) => {
			try {
				if (!parseFilleError) this.parser.addLine(line);
			} catch (e) {
				parseFilleError = e;
			}
		});
		return new Promise((resolve, reject) => {
			rl.on(`close`, () => {
				if (parseFilleError) reject(parseFilleError);
				else resolve(this.parser.finish());
			});
		});
	}
};
//#endregion
//#region src/vitest/configuration.ts
function getDefaultConfiguration() {
	return {
		language: "en",
		includeTags: [],
		excludeTags: ["ignore"],
		onStepError: ({ error }) => {},
		predefinedSteps: [],
		mappedExamples: {}
	};
}
let globalConfiguration = {
	predefinedSteps: [],
	mappedExamples: {}
};
const getVitestCucumberConfiguration = (options) => {
	const defaultConfiguration = getDefaultConfiguration();
	const importMetaEnv = typeof import.meta !== "undefined" ? import.meta.env : void 0;
	const processEnv = typeof process !== "undefined" ? process.env : void 0;
	defaultConfiguration.includeTags?.push(...importMetaEnv?.VITEST_INCLUDE_TAGS?.split(" ") ?? [], ...processEnv?.VITEST_INCLUDE_TAGS?.split(" ") ?? []);
	defaultConfiguration.excludeTags?.push(...importMetaEnv?.VITEST_EXCLUDE_TAGS?.split(" ") ?? [], ...processEnv?.VITEST_EXCLUDE_TAGS?.split(" ") ?? []);
	return {
		...defaultConfiguration,
		...globalConfiguration,
		...options || {}
	};
};
//#endregion
//#region src/vitest/load-feature.ts
function getCallerPath() {
	const { 2: callerFilePath } = callsites();
	return dirname(callerFilePath?.getFileName() || ``);
}
async function loadFeature(featureFilePath, options) {
	const callerFileDir = getCallerPath();
	const [feature] = await FeatureFileReader.fromPath({
		featureFilePath,
		callerFileDir,
		options: getVitestCucumberConfiguration(options)
	}).parseFile();
	return feature;
}
//#endregion
//#region scripts/generateFile.ts
function generateStep(step) {
	if (step.docStrings) return `      ${step.type}(\`${step.details}\`, (_, docString: string) => { })`;
	return `      ${step.type}(\`${step.details}\`, () => { })`;
}
function generateScenarii(scenarii, forRule = false) {
	const fileContent = [""];
	for (const scenario of scenarii) {
		const isOutline = scenario instanceof ScenarioOutline;
		const scenarioStepTypes = [
			"Given",
			"When",
			"Then",
			"And",
			"But"
		].filter((step) => scenario.steps.map((scenarioSteps) => scenarioSteps.type).includes(step));
		let scenarioType = "Scenario";
		if (isOutline) scenarioType = forRule ? "RuleScenarioOutline" : "ScenarioOutline";
		else scenarioType = forRule ? "RuleScenario" : "Scenario";
		if (isOutline) fileContent.push(`  ${scenarioType}(\`${scenario.description}\`, ({ ${scenarioStepTypes.join(", ")} }, variables) => {`);
		else fileContent.push(`  ${scenarioType}(\`${scenario.description}\`, ({ ${scenarioStepTypes.join(", ")} }) => {`);
		for (const step of scenario.steps) fileContent.push(generateStep(step));
		fileContent.push(`  })`);
	}
	return fileContent;
}
function generateBackground(back, forRule = false) {
	const fileContent = [""];
	const scenarioStepTypes = [
		"Given",
		"When",
		"Then",
		"And",
		"But"
	].filter((step) => back.steps.map((scenarioSteps) => scenarioSteps.type.toString()).includes(step));
	const scenarioType = forRule ? "RuleBackground" : "Background";
	fileContent.push(`  ${scenarioType}(({ ${scenarioStepTypes.join(", ")} }) => {`);
	for (const step of back.steps) fileContent.push(`      ${step.type}(\`${step.details}\`, () => { })`);
	fileContent.push(`  })`);
	return fileContent;
}
function generateRules(rules) {
	const fileContent = [];
	for (const r of rules) {
		const rulesHook = [];
		if (r.background) rulesHook.push("RuleBackground");
		if (r.scenarii.some((s) => s instanceof ScenarioOutline)) rulesHook.push("RuleScenarioOutline");
		if (r.scenarii.some((s) => !(s instanceof ScenarioOutline))) rulesHook.push("RuleScenario");
		fileContent.push("");
		fileContent.push(`  Rule(\`${r.name}\`, ({ ${rulesHook.join(", ")} }) => {`);
		if (r.background) fileContent.push(...generateBackground(r.background, true));
		fileContent.push(...generateScenarii(r.scenarii, true));
		fileContent.push("");
		fileContent.push(`  })`);
	}
	return fileContent;
}
async function writeSpecFile({ feature, specFilePath, featureFilePath }) {
	const featureHasBackground = feature.background !== null;
	const featureHasScenario = feature.scenarii.some((s) => !(s instanceof ScenarioOutline));
	const featureHasScenarioOutline = feature.scenarii.some((s) => s instanceof ScenarioOutline);
	const fileContentLines = [];
	const describeHook = [
		"BeforeAllScenarios",
		"AfterAllScenarios",
		"BeforeEachScenario",
		"AfterEachScenario"
	];
	const describeFeatureArgs = [...describeHook];
	if (featureHasBackground) describeFeatureArgs.push("Background");
	if (featureHasScenarioOutline) describeFeatureArgs.push("ScenarioOutline");
	if (featureHasScenario) describeFeatureArgs.push("Scenario");
	if (feature.rules.length > 0) describeFeatureArgs.push("Rule");
	fileContentLines.push("import { loadFeature, describeFeature } from \"@amiceli/vitest-cucumber\"");
	fileContentLines.push("");
	fileContentLines.push(`const feature = await loadFeature('${featureFilePath}')`);
	fileContentLines.push("");
	fileContentLines.push(`describeFeature(feature, ({ ${describeFeatureArgs.join(", ")} }) => {`);
	for (const s of describeHook) fileContentLines.push(`  ${s}(() => {})`);
	if (featureHasBackground) fileContentLines.push(...generateBackground(feature.background));
	fileContentLines.push(...generateScenarii(feature.scenarii), ...generateRules(feature.rules));
	fileContentLines.push("");
	fileContentLines.push(`})`);
	await fs$1.writeFile(specFilePath, fileContentLines.join("\n"));
}
//#endregion
//#region scripts/cli.ts
const { feature, spec, lang } = minimist(process.argv.slice(2));
if (!feature) {
	console.error("--feature option is required");
	process.exit(-1);
}
if (!spec) {
	console.error("--spec option is required");
	process.exit(-1);
}
loadFeature(feature, { language: lang || "en" }).then((f) => {
	writeSpecFile({
		feature: f,
		featureFilePath: feature,
		specFilePath: spec
	});
});
//#endregion
export {};
