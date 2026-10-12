#!/usr/bin/env node
/**
 * Automated Requirement-to-Code Alignment Diff Algorithm
 * 
 * This script analyzes project specification requirements and matches them to 
 * implementation evidence (selectors, functions, constants) in the codebase.
 * Outputs a status matrix CSV with alignment results.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Enums
const ImplementationStatus = {
    IMPLEMENTED: "Implemented",
    PARTIALLY_IMPLEMENTED: "Partially",
    MISSING: "Missing", 
    INCONSISTENT: "Inconsistent"
};

class RequirementSpec {
    constructor(id, text, category, priority = "Medium", userStory = "", technicalDetails = [], acceptanceCriteria = []) {
        this.id = id;
        this.text = text;
        this.category = category;
        this.priority = priority;
        this.userStory = userStory;
        this.technicalDetails = technicalDetails;
        this.acceptanceCriteria = acceptanceCriteria;
    }
}

class ImplementationEvidence {
    constructor(filePath, lineNumber, codeType, name, content, contextLines = []) {
        this.filePath = filePath;
        this.lineNumber = lineNumber;
        this.codeType = codeType; // 'function', 'constant', 'selector', 'class', 'variable'
        this.name = name;
        this.content = content;
        this.contextLines = contextLines;
    }
}

class RequirementAlignment {
    constructor(requirement, status, evidence = [], confidenceScore = 0.0, notes = "", coveragePercentage = 0.0) {
        this.requirement = requirement;
        this.status = status;
        this.evidence = evidence;
        this.confidenceScore = confidenceScore;
        this.notes = notes;
        this.coveragePercentage = coveragePercentage;
    }
}

class RequirementExtractor {
    constructor(specFiles) {
        this.specFiles = specFiles;
        this.requirements = [];
    }

    extractRequirements() {
        const allRequirements = [];
        
        for (const specFile of this.specFiles) {
            if (fs.existsSync(specFile)) {
                const requirements = this.parseSpecFile(specFile);
                allRequirements.push(...requirements);
            }
        }
        
        // Deduplicate and assign IDs
        this.requirements = this.deduplicateRequirements(allRequirements);
        return this.requirements;
    }

    parseSpecFile(filePath) {
        const requirements = [];
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Extract user stories (As a... I want... so that...)
        const userStoryPattern = /(?:^|\n)\* As a ([^,]+), I (?:want to |can |need to )?([^,]+?)(?:,?\s*so that (.+?))?(?=\n|$)/gmi;
        let match;
        
        while ((match = userStoryPattern.exec(content)) !== null) {
            const [fullMatch, userType, action, benefit] = match;
            const reqId = `US_${crypto.createHash('md5').update(`${userType}_${action}`).digest('hex').substring(0, 8)}`;
            let userStoryText = `As a ${userType.trim()}, I ${action.trim()}`;
            if (benefit) {
                userStoryText += ` so that ${benefit.trim()}`;
            }
            
            requirements.push(new RequirementSpec(
                reqId,
                userStoryText,
                "User Story",
                "Medium",
                userStoryText,
                this.extractRelatedTechnicalDetails(content, action)
            ));
        }
        
        // Extract feature requirements
        const featureSections = this.extractFeatureSections(content);
        for (const [sectionName, sectionContent] of Object.entries(featureSections)) {
            const features = this.extractFeaturesFromSection(sectionContent, sectionName);
            requirements.push(...features);
        }
        
        // Extract technical requirements
        const techRequirements = this.extractTechnicalRequirements(content);
        requirements.push(...techRequirements);
        
        return requirements;
    }

    extractFeatureSections(content) {
        const sections = {};
        
        // Match section headers and their content
        const sectionPattern = /^(#{1,3})\s*([^#\n]+?)(?=\n(?:#{1,3}|\Z))/gm;
        const matches = [...content.matchAll(sectionPattern)];
        
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const level = match[1].length;
            const title = match[2].trim();
            
            // Filter for relevant feature sections
            if (['engine', 'system', 'management', 'mechanic', 'interface', 'progression', 'gameplay', 'feature']
                .some(keyword => title.toLowerCase().includes(keyword))) {
                
                // Extract the section content until next header of same or higher level
                const startPos = match.index + match[0].length;
                const nextHeaderPattern = new RegExp(`\\n#{1,${level}}\\s`, 'g');
                nextHeaderPattern.lastIndex = startPos;
                const nextMatch = nextHeaderPattern.exec(content);
                
                const sectionContent = nextMatch 
                    ? content.substring(startPos, nextMatch.index)
                    : content.substring(startPos);
                
                sections[title] = sectionContent.trim();
            }
        }
        
        return sections;
    }

    extractFeaturesFromSection(sectionContent, sectionName) {
        const requirements = [];
        
        // Extract bullet points as features
        const featurePattern = /^\s*[*-]\s+(.+?)(?=\n\s*[*-]|\n\n|\Z)/gm;
        const features = [...sectionContent.matchAll(featurePattern)];
        
        for (const match of features) {
            let featureText = match[1].replace(/\s+/g, ' ').trim();
            if (featureText.length > 10) { // Filter out very short items
                const reqId = `FT_${crypto.createHash('md5').update(`${sectionName}_${featureText.substring(0, 50)}`).digest('hex').substring(0, 8)}`;
                
                requirements.push(new RequirementSpec(
                    reqId,
                    featureText,
                    `Feature - ${sectionName}`,
                    "Medium",
                    "",
                    this.extractTechnicalKeywords(featureText)
                ));
            }
        }
        
        return requirements;
    }

    extractTechnicalRequirements(content) {
        const requirements = [];
        
        // Extract performance requirements
        const perfPattern = /(?:performance|fps|speed|optimization|scalability)[:\s]*([^.\n]+)/gi;
        const perfMatches = [...content.matchAll(perfPattern)];
        
        for (const match of perfMatches) {
            const reqId = `PERF_${crypto.createHash('md5').update(match[1]).digest('hex').substring(0, 8)}`;
            requirements.push(new RequirementSpec(
                reqId,
                `Performance: ${match[1].trim()}`,
                "Technical - Performance",
                "High"
            ));
        }
        
        // Extract data requirements
        const dataPattern = /(?:storage|data|persistence|backup)[:\s]*([^.\n]+)/gi;
        const dataMatches = [...content.matchAll(dataPattern)];
        
        for (const match of dataMatches) {
            const reqId = `DATA_${crypto.createHash('md5').update(match[1]).digest('hex').substring(0, 8)}`;
            requirements.push(new RequirementSpec(
                reqId,
                `Data: ${match[1].trim()}`,
                "Technical - Data",
                "Medium"
            ));
        }
        
        return requirements;
    }

    extractTechnicalKeywords(text) {
        const keywords = [];
        
        // Common technical terms to look for
        const techTerms = [
            'click', 'button', 'form', 'input', 'display', 'animation', 'timer',
            'canvas', 'element', 'function', 'class', 'variable', 'event',
            'loop', 'interval', 'timeout', 'callback', 'listener', 'handler',
            'health', 'xp', 'points', 'level', 'enemy', 'base', 'attack',
            'task', 'habit', 'routine', 'completion', 'streak', 'category'
        ];
        
        const textLower = text.toLowerCase();
        for (const term of techTerms) {
            if (textLower.includes(term)) {
                keywords.push(term);
            }
        }
        
        return keywords;
    }

    extractRelatedTechnicalDetails(content, action) {
        const details = [];
        const actionLower = action.toLowerCase();
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(actionLower)) {
                // Collect surrounding technical details
                const start = Math.max(0, i - 2);
                const end = Math.min(lines.length, i + 3);
                const context = lines.slice(start, end);
                
                for (const ctxLine of context) {
                    if (['function', 'class', 'element', 'button', 'form', 'api']
                        .some(techWord => ctxLine.toLowerCase().includes(techWord))) {
                        details.push(ctxLine.trim());
                    }
                }
            }
        }
        
        return details;
    }

    deduplicateRequirements(requirements) {
        const uniqueRequirements = [];
        const seenTexts = new Set();
        
        for (const req of requirements) {
            // Create a normalized version for comparison
            const normalized = req.text.toLowerCase().replace(/\s+/g, ' ').trim();
            
            if (!seenTexts.has(normalized) && normalized.length > 5) {
                seenTexts.add(normalized);
                uniqueRequirements.push(req);
            }
        }
        
        return uniqueRequirements;
    }
}

class CodeAnalyzer {
    constructor(codeDirectories, filePatterns = ['*.js', '*.html', '*.css', '*.py', '*.md']) {
        this.codeDirectories = codeDirectories;
        this.filePatterns = filePatterns;
        this.evidence = [];
    }

    analyzeCodebase() {
        const evidence = [];
        
        for (const directory of this.codeDirectories) {
            if (fs.existsSync(directory)) {
                evidence.push(...this.analyzeDirectory(directory));
            }
        }
        
        this.evidence = evidence;
        return evidence;
    }

    analyzeDirectory(directory) {
        const evidence = [];
        
        const walkSync = (dir) => {
            const files = fs.readdirSync(dir);
            
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory()) {
                    walkSync(filePath);
                } else if (this.shouldAnalyzeFile(file)) {
                    try {
                        const fileEvidence = this.analyzeFile(filePath);
                        evidence.push(...fileEvidence);
                    } catch (error) {
                        console.log(`Error analyzing ${filePath}: ${error.message}`);
                    }
                }
            }
        };
        
        walkSync(directory);
        return evidence;
    }

    shouldAnalyzeFile(filename) {
        return ['.js', '.html', '.css', '.py'].some(ext => filename.endsWith(ext));
    }

    analyzeFile(filePath) {
        const evidence = [];
        
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const lineEvidence = this.analyzeLine(filePath, i + 1, lines[i], lines);
                evidence.push(...lineEvidence);
            }
        } catch (error) {
            // Skip files that can't be read
        }
        
        return evidence;
    }

    analyzeLine(filePath, lineNum, line, allLines) {
        const evidence = [];
        
        if (filePath.endsWith('.js')) {
            evidence.push(...this.extractJsEvidence(filePath, lineNum, line, allLines));
        } else if (filePath.endsWith('.html')) {
            evidence.push(...this.extractHtmlEvidence(filePath, lineNum, line, allLines));
        } else if (filePath.endsWith('.css')) {
            evidence.push(...this.extractCssEvidence(filePath, lineNum, line, allLines));
        } else if (filePath.endsWith('.py')) {
            evidence.push(...this.extractPythonEvidence(filePath, lineNum, line, allLines));
        }
        
        return evidence;
    }

    extractJsEvidence(filePath, lineNum, line, allLines) {
        const evidence = [];
        const lineStrip = line.trim();
        
        // Function declarations
        const funcPatterns = [
            /function\s+(\w+)\s*\(/g,
            /const\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>)/g,
            /let\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>)/g,
            /(\w+):\s*function\s*\(/g,
            /(\w+)\s*\([^)]*\)\s*{/g
        ];
        
        for (const pattern of funcPatterns) {
            let match;
            while ((match = pattern.exec(line)) !== null) {
                const funcName = match[1];
                evidence.push(new ImplementationEvidence(
                    filePath,
                    lineNum,
                    'function',
                    funcName,
                    lineStrip,
                    this.getContextLines(allLines, lineNum, 2)
                ));
            }
        }
        
        // Constants and variables
        const constPatterns = [
            /const\s+([A-Z_][A-Z0-9_]*)\s*=/g,
            /let\s+([a-zA-Z_]\w*)/g,
            /var\s+([a-zA-Z_]\w*)/g
        ];
        
        for (const pattern of constPatterns) {
            let match;
            while ((match = pattern.exec(line)) !== null) {
                const varName = match[1];
                evidence.push(new ImplementationEvidence(
                    filePath,
                    lineNum,
                    varName === varName.toUpperCase() ? 'constant' : 'variable',
                    varName,
                    lineStrip,
                    this.getContextLines(allLines, lineNum, 1)
                ));
            }
        }
        
        // Event listeners and DOM selectors
        const selectorPatterns = [
            /getElementById\(['"]([^'"]+)['"]\)/g,
            /querySelector\(['"]([^'"]+)['"]\)/g,
            /getElementsByClassName\(['"]([^'"]+)['"]\)/g
        ];
        
        for (const pattern of selectorPatterns) {
            let match;
            while ((match = pattern.exec(line)) !== null) {
                const selector = match[1];
                evidence.push(new ImplementationEvidence(
                    filePath,
                    lineNum,
                    'selector',
                    selector,
                    lineStrip,
                    this.getContextLines(allLines, lineNum, 1)
                ));
            }
        }
        
        return evidence;
    }

    extractHtmlEvidence(filePath, lineNum, line, allLines) {
        const evidence = [];
        
        // HTML elements with IDs
        const idPattern = /<(\w+)[^>]*id=['"]([^'"]+)['"][^>]*>/g;
        let match;
        while ((match = idPattern.exec(line)) !== null) {
            const elementId = match[2];
            evidence.push(new ImplementationEvidence(
                filePath,
                lineNum,
                'selector',
                elementId,
                line.trim(),
                this.getContextLines(allLines, lineNum, 1)
            ));
        }
        
        // HTML elements with classes
        const classPattern = /<(\w+)[^>]*class=['"]([^'"]+)['"][^>]*>/g;
        while ((match = classPattern.exec(line)) !== null) {
            const classes = match[2].split(/\s+/);
            for (const className of classes) {
                evidence.push(new ImplementationEvidence(
                    filePath,
                    lineNum,
                    'selector',
                    className,
                    line.trim(),
                    this.getContextLines(allLines, lineNum, 1)
                ));
            }
        }
        
        return evidence;
    }

    extractCssEvidence(filePath, lineNum, line, allLines) {
        const evidence = [];
        
        // CSS class and ID selectors
        const selectorPattern = /([.#]?[\w-]+)\s*{/g;
        let match;
        while ((match = selectorPattern.exec(line)) !== null) {
            const selector = match[1];
            evidence.push(new ImplementationEvidence(
                filePath,
                lineNum,
                'selector',
                selector,
                line.trim(),
                this.getContextLines(allLines, lineNum, 1)
            ));
        }
        
        return evidence;
    }

    extractPythonEvidence(filePath, lineNum, line, allLines) {
        const evidence = [];
        
        // Function definitions
        const funcPattern = /def\s+(\w+)\s*\(/g;
        let match;
        while ((match = funcPattern.exec(line)) !== null) {
            const funcName = match[1];
            evidence.push(new ImplementationEvidence(
                filePath,
                lineNum,
                'function',
                funcName,
                line.trim(),
                this.getContextLines(allLines, lineNum, 2)
            ));
        }
        
        // Class definitions
        const classPattern = /class\s+(\w+)\s*(?:\([^)]*\))?:/g;
        while ((match = classPattern.exec(line)) !== null) {
            const className = match[1];
            evidence.push(new ImplementationEvidence(
                filePath,
                lineNum,
                'class',
                className,
                line.trim(),
                this.getContextLines(allLines, lineNum, 2)
            ));
        }
        
        return evidence;
    }

    getContextLines(allLines, lineNum, contextSize = 2) {
        const start = Math.max(0, lineNum - contextSize - 1);
        const end = Math.min(allLines.length, lineNum + contextSize);
        return allLines.slice(start, end).map(line => line.trim());
    }
}

class RequirementMatcher {
    constructor(requirements, evidence) {
        this.requirements = requirements;
        this.evidence = evidence;
        this.alignments = [];
    }

    matchRequirementsToEvidence() {
        const alignments = [];
        
        for (const requirement of this.requirements) {
            const alignment = this.matchSingleRequirement(requirement);
            alignments.push(alignment);
        }
        
        this.alignments = alignments;
        return alignments;
    }

    matchSingleRequirement(requirement) {
        // Extract keywords from requirement
        const keywords = this.extractKeywordsFromRequirement(requirement);
        
        // Score each piece of evidence against the requirement
        const evidenceScores = [];
        for (const evidence of this.evidence) {
            const score = this.calculateEvidenceScore(requirement, evidence, keywords);
            if (score > 0.3) { // Threshold for relevance
                evidenceScores.push([evidence, score]);
            }
        }
        
        // Sort by score and take the best matches
        evidenceScores.sort((a, b) => b[1] - a[1]);
        const matchedEvidence = evidenceScores.slice(0, 10).map(pair => pair[0]); // Top 10 matches
        
        // Determine implementation status
        const status = this.determineImplementationStatus(requirement, matchedEvidence);
        
        // Calculate confidence and coverage
        const confidence = this.calculateConfidenceScore(requirement, matchedEvidence);
        const coverage = this.calculateCoveragePercentage(requirement, matchedEvidence);
        
        return new RequirementAlignment(
            requirement,
            status,
            matchedEvidence,
            confidence,
            this.generateAlignmentNotes(requirement, matchedEvidence, status),
            coverage
        );
    }

    extractKeywordsFromRequirement(requirement) {
        const keywords = [];
        const text = requirement.text.toLowerCase();
        
        // Common domain-specific keywords
        const domainKeywords = {
            'task': ['task', 'item', 'todo', 'deadline', 'due'],
            'habit': ['habit', 'routine', 'daily', 'streak', 'completion'],
            'game': ['enemy', 'zombie', 'base', 'health', 'attack', 'defeat'],
            'ui': ['button', 'form', 'input', 'display', 'click', 'element'],
            'progression': ['xp', 'level', 'points', 'upgrade', 'unlock']
        };
        
        // Add domain keywords found in requirement
        for (const [domain, words] of Object.entries(domainKeywords)) {
            for (const word of words) {
                if (text.includes(word)) {
                    keywords.push(...words);
                    break;
                }
            }
        }
        
        // Extract nouns and verbs
        const words = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
        keywords.push(...words.filter(word => word.length > 3).map(word => word.toLowerCase()));
        
        // Add technical details
        keywords.push(...requirement.technicalDetails);
        
        // Remove duplicates and filter
        return [...new Set(keywords)].filter(k => k.length > 2);
    }

    calculateEvidenceScore(requirement, evidence, keywords) {
        let score = 0.0;
        
        // Direct keyword matching
        const evidenceText = `${evidence.name} ${evidence.content}`.toLowerCase();
        const keywordMatches = keywords.filter(keyword => evidenceText.includes(keyword)).length;
        
        if (keywords.length > 0) {
            const keywordScore = keywordMatches / keywords.length;
            score += keywordScore * 0.4;
        }
        
        // Name similarity
        const nameSimilarity = this.calculateNameSimilarity(requirement.text, evidence.name);
        score += nameSimilarity * 0.3;
        
        // Code type relevance
        const typeRelevance = this.calculateTypeRelevance(requirement, evidence);
        score += typeRelevance * 0.2;
        
        // Context matching
        const contextText = evidence.contextLines.join(' ').toLowerCase();
        const contextMatches = keywords.filter(keyword => contextText.includes(keyword)).length;
        if (keywords.length > 0) {
            const contextScore = contextMatches / keywords.length;
            score += contextScore * 0.1;
        }
        
        return Math.min(score, 1.0);
    }

    calculateNameSimilarity(requirementText, evidenceName) {
        const reqWords = new Set((requirementText.toLowerCase().match(/\b[a-zA-Z]{3,}\b/g) || []));
        const evidenceWords = new Set((evidenceName.toLowerCase().match(/\b[a-zA-Z]{3,}\b/g) || []));
        
        if (reqWords.size === 0) return 0.0;
        
        const intersection = new Set([...reqWords].filter(word => evidenceWords.has(word)));
        return intersection.size / reqWords.size;
    }

    calculateTypeRelevance(requirement, evidence) {
        const typeRelevanceMap = {
            'User Story': {
                'function': 0.8,
                'selector': 0.6,
                'variable': 0.4,
                'constant': 0.3,
                'class': 0.7
            },
            'Feature': {
                'function': 0.9,
                'selector': 0.5,
                'variable': 0.4,
                'constant': 0.6,
                'class': 0.8
            },
            'Technical': {
                'function': 0.7,
                'selector': 0.3,
                'variable': 0.5,
                'constant': 0.8,
                'class': 0.9
            }
        };
        
        const categoryKey = requirement.category.split(' - ')[0];
        
        if (typeRelevanceMap[categoryKey]) {
            return typeRelevanceMap[categoryKey][evidence.codeType] || 0.3;
        }
        
        return 0.5; // Default relevance
    }

    determineImplementationStatus(requirement, evidence) {
        if (evidence.length === 0) {
            return ImplementationStatus.MISSING;
        }
        
        const evidenceTypes = new Set(evidence.map(ev => ev.codeType));
        const evidenceCount = evidence.length;
        
        // Determine status based on evidence quantity and quality
        if (evidenceCount >= 3 && evidenceTypes.size >= 2) {
            return ImplementationStatus.IMPLEMENTED;
        } else if (evidenceCount >= 1 && evidenceTypes.size >= 1) {
            return ImplementationStatus.PARTIALLY_IMPLEMENTED;
        } else if (evidenceCount > 0) {
            // Check if evidence seems contradictory
            const names = evidence.map(ev => ev.name);
            const uniqueNames = new Set(names);
            if (uniqueNames.size > evidenceCount * 0.8) { // High name diversity might indicate confusion
                return ImplementationStatus.INCONSISTENT;
            }
            return ImplementationStatus.PARTIALLY_IMPLEMENTED;
        } else {
            return ImplementationStatus.MISSING;
        }
    }

    calculateConfidenceScore(requirement, evidence) {
        if (evidence.length === 0) return 0.0;
        
        const keywords = this.extractKeywordsFromRequirement(requirement);
        if (keywords.length === 0) return 0.3;
        
        // Average evidence scores
        let totalScore = 0.0;
        for (const ev of evidence) {
            const score = this.calculateEvidenceScore(requirement, ev, keywords);
            totalScore += score;
        }
        
        const avgScore = totalScore / evidence.length;
        
        // Boost confidence if multiple evidence types
        const evidenceTypes = new Set(evidence.map(ev => ev.codeType)).size;
        const typeBonus = Math.min(evidenceTypes * 0.1, 0.3);
        
        return Math.min(avgScore + typeBonus, 1.0);
    }

    calculateCoveragePercentage(requirement, evidence) {
        const keywords = this.extractKeywordsFromRequirement(requirement);
        if (keywords.length === 0) {
            return evidence.length > 0 ? 50.0 : 0.0;
        }
        
        const coveredKeywords = new Set();
        for (const ev of evidence) {
            const evidenceText = `${ev.name} ${ev.content}`.toLowerCase();
            for (const keyword of keywords) {
                if (evidenceText.includes(keyword)) {
                    coveredKeywords.add(keyword);
                }
            }
        }
        
        return (coveredKeywords.size / keywords.length) * 100;
    }

    generateAlignmentNotes(requirement, evidence, status) {
        const notes = [];
        
        if (status === ImplementationStatus.IMPLEMENTED) {
            const evidenceTypes = new Set(evidence.map(ev => ev.codeType));
            notes.push(`Found ${evidence.length} pieces of evidence across ${evidenceTypes.size} code types`);
            
            if (evidence.length > 0) {
                const mainFiles = new Set(evidence.slice(0, 3).map(ev => path.basename(ev.filePath)));
                notes.push(`Primary implementation in: ${[...mainFiles].join(', ')}`);
            }
        } else if (status === ImplementationStatus.PARTIALLY_IMPLEMENTED) {
            notes.push("Partial implementation detected");
            if (evidence.length > 0) {
                notes.push(`Found evidence in ${evidence[0].codeType}: ${evidence[0].name}`);
            }
        } else if (status === ImplementationStatus.MISSING) {
            const keywords = this.extractKeywordsFromRequirement(requirement);
            if (keywords.length > 0) {
                notes.push(`No evidence found for key terms: ${keywords.slice(0, 3).join(', ')}`);
            } else {
                notes.push("Requirement text lacks specific implementation keywords");
            }
        } else if (status === ImplementationStatus.INCONSISTENT) {
            notes.push("Conflicting or unclear evidence found");
            if (evidence.length > 0) {
                const names = evidence.slice(0, 3).map(ev => ev.name);
                notes.push(`Multiple implementations: ${names.join(', ')}`);
            }
        }
        
        return notes.join('; ');
    }
}

class CSVReportGenerator {
    constructor(alignments) {
        this.alignments = alignments;
    }

    generateMatrixCSV(outputFile = "requirement_alignment_matrix.csv") {
        const header = [
            'Requirement_ID', 'Requirement_Text', 'Category', 'Priority',
            'Status', 'Confidence_Score', 'Coverage_Percentage',
            'Evidence_Count', 'Evidence_Types', 'Implementation_Files',
            'Key_Functions', 'Key_Selectors', 'Key_Constants',
            'Notes', 'User_Story'
        ].join(',') + '\n';
        
        let csvContent = header;
        
        for (const alignment of this.alignments) {
            // Group evidence by type
            const evidenceByType = {};
            for (const evidence of alignment.evidence) {
                if (!evidenceByType[evidence.codeType]) {
                    evidenceByType[evidence.codeType] = [];
                }
                evidenceByType[evidence.codeType].push(evidence);
            }
            
            // Extract file names
            const files = [...new Set(alignment.evidence.map(ev => path.basename(ev.filePath)))];
            
            const row = [
                this.escapeCSV(alignment.requirement.id),
                this.escapeCSV(alignment.requirement.text.substring(0, 200) + (alignment.requirement.text.length > 200 ? '...' : '')),
                this.escapeCSV(alignment.requirement.category),
                this.escapeCSV(alignment.requirement.priority),
                this.escapeCSV(alignment.status),
                alignment.confidenceScore.toFixed(2),
                alignment.coveragePercentage.toFixed(1) + '%',
                alignment.evidence.length,
                this.escapeCSV(Object.keys(evidenceByType).join(', ')),
                this.escapeCSV(files.slice(0, 3).join(', ')), // Top 3 files
                this.escapeCSV((evidenceByType['function'] || []).slice(0, 3).map(ev => ev.name).join(', ')),
                this.escapeCSV((evidenceByType['selector'] || []).slice(0, 3).map(ev => ev.name).join(', ')),
                this.escapeCSV((evidenceByType['constant'] || []).slice(0, 3).map(ev => ev.name).join(', ')),
                this.escapeCSV(alignment.notes),
                this.escapeCSV(alignment.requirement.userStory)
            ].join(',') + '\n';
            
            csvContent += row;
        }
        
        fs.writeFileSync(outputFile, csvContent);
    }

    generateDetailedEvidenceCSV(outputFile = "detailed_evidence.csv") {
        const header = [
            'Requirement_ID', 'Evidence_File', 'Evidence_Line', 'Evidence_Type',
            'Evidence_Name', 'Evidence_Content', 'Match_Score'
        ].join(',') + '\n';
        
        let csvContent = header;
        
        for (const alignment of this.alignments) {
            const keywords = this.extractKeywordsFromAlignment(alignment);
            
            for (const evidence of alignment.evidence) {
                // Calculate individual match score
                const score = this.calculateEvidenceScoreForRequirement(alignment.requirement, evidence, keywords);
                
                const row = [
                    this.escapeCSV(alignment.requirement.id),
                    this.escapeCSV(evidence.filePath),
                    evidence.lineNumber,
                    this.escapeCSV(evidence.codeType),
                    this.escapeCSV(evidence.name),
                    this.escapeCSV(evidence.content.substring(0, 100) + (evidence.content.length > 100 ? '...' : '')),
                    score.toFixed(3)
                ].join(',') + '\n';
                
                csvContent += row;
            }
        }
        
        fs.writeFileSync(outputFile, csvContent);
    }

    generateSummaryCSV(outputFile = "alignment_summary.csv") {
        const statusCounts = {};
        const categoryStats = {};
        
        for (const alignment of this.alignments) {
            // Count by status
            const status = alignment.status;
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            // Count by category
            const category = alignment.requirement.category;
            if (!categoryStats[category]) {
                categoryStats[category] = {
                    total: 0, implemented: 0, partially: 0, 
                    missing: 0, inconsistent: 0
                };
            }
            
            categoryStats[category].total += 1;
            
            if (status === 'Implemented') {
                categoryStats[category].implemented += 1;
            } else if (status === 'Partially') {
                categoryStats[category].partially += 1;
            } else if (status === 'Missing') {
                categoryStats[category].missing += 1;
            } else if (status === 'Inconsistent') {
                categoryStats[category].inconsistent += 1;
            }
        }
        
        const header = [
            'Metric', 'Category', 'Implemented', 'Partially', 
            'Missing', 'Inconsistent', 'Total', 'Implementation_Rate'
        ].join(',') + '\n';
        
        let csvContent = header;
        
        // Overall summary
        const totalReqs = this.alignments.length;
        const implemented = statusCounts['Implemented'] || 0;
        const implRate = totalReqs > 0 ? (implemented / totalReqs * 100) : 0;
        
        csvContent += [
            'Overall',
            'All Requirements',
            statusCounts['Implemented'] || 0,
            statusCounts['Partially'] || 0,
            statusCounts['Missing'] || 0,
            statusCounts['Inconsistent'] || 0,
            totalReqs,
            implRate.toFixed(1) + '%'
        ].join(',') + '\n';
        
        // Category breakdowns
        for (const [category, stats] of Object.entries(categoryStats)) {
            const implRate = stats.total > 0 ? (stats.implemented / stats.total * 100) : 0;
            csvContent += [
                'Category',
                this.escapeCSV(category),
                stats.implemented,
                stats.partially,
                stats.missing,
                stats.inconsistent,
                stats.total,
                implRate.toFixed(1) + '%'
            ].join(',') + '\n';
        }
        
        fs.writeFileSync(outputFile, csvContent);
    }

    extractKeywordsFromAlignment(alignment) {
        const text = alignment.requirement.text.toLowerCase();
        const words = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
        return words.filter(word => word.length > 3).map(word => word.toLowerCase());
    }

    calculateEvidenceScoreForRequirement(requirement, evidence, keywords) {
        const evidenceText = `${evidence.name} ${evidence.content}`.toLowerCase();
        const keywordMatches = keywords.filter(keyword => evidenceText.includes(keyword)).length;
        
        if (keywords.length > 0) {
            return keywordMatches / keywords.length;
        }
        return 0.5;
    }

    escapeCSV(str) {
        if (typeof str !== 'string') return str;
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }
}

function main() {
    console.log("🔍 Starting Requirement-to-Code Alignment Analysis...");
    
    // Configuration
    const specFiles = [
        "./PROJECT_SPEC.md",
        "./shared_workspace/01_PROJECT_SPEC.md",
        "./IMPLEMENTATION_MANIFEST.md"
    ];
    
    const codeDirectories = [
        ".",
        "./shared_workspace",
        "./Deadline-MPE"
    ];
    
    // Step 1: Extract Requirements
    console.log("📋 Extracting requirements from specifications...");
    const reqExtractor = new RequirementExtractor(specFiles);
    const requirements = reqExtractor.extractRequirements();
    console.log(`   Found ${requirements.length} requirements`);
    
    // Step 2: Analyze Codebase
    console.log("🔬 Analyzing codebase for implementation evidence...");
    const codeAnalyzer = new CodeAnalyzer(codeDirectories);
    const evidence = codeAnalyzer.analyzeCodebase();
    console.log(`   Found ${evidence.length} pieces of evidence`);
    
    // Step 3: Match Requirements to Evidence
    console.log("🎯 Matching requirements to implementation evidence...");
    const matcher = new RequirementMatcher(requirements, evidence);
    const alignments = matcher.matchRequirementsToEvidence();
    
    // Calculate summary statistics
    const statusCounts = {};
    for (const alignment of alignments) {
        const status = alignment.status;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
    
    console.log(`   ✅ Implemented: ${statusCounts['Implemented'] || 0}`);
    console.log(`   🔄 Partially: ${statusCounts['Partially'] || 0}`);
    console.log(`   ❌ Missing: ${statusCounts['Missing'] || 0}`);
    console.log(`   ⚠️  Inconsistent: ${statusCounts['Inconsistent'] || 0}`);
    
    // Step 4: Generate CSV Reports
    console.log("📊 Generating CSV reports...");
    const reportGenerator = new CSVReportGenerator(alignments);
    
    // Generate main matrix
    reportGenerator.generateMatrixCSV();
    console.log("   📄 Generated: requirement_alignment_matrix.csv");
    
    // Generate detailed evidence
    reportGenerator.generateDetailedEvidenceCSV();
    console.log("   📄 Generated: detailed_evidence.csv");
    
    // Generate summary
    reportGenerator.generateSummaryCSV();
    console.log("   📄 Generated: alignment_summary.csv");
    
    console.log("\n🎉 Analysis complete! Check the generated CSV files for detailed results.");
    
    // Display top findings
    console.log("\n📈 Top Implementation Gaps:");
    const missingReqs = alignments.filter(a => a.status === ImplementationStatus.MISSING);
    for (const req of missingReqs.slice(0, 5)) {
        console.log(`   • ${req.requirement.id}: ${req.requirement.text.substring(0, 80)}...`);
    }
    
    console.log(`\n🔍 Analysis Summary:`);
    console.log(`   Total Requirements: ${requirements.length}`);
    console.log(`   Total Evidence: ${evidence.length}`);
    const totalImplRate = requirements.length > 0 ? ((statusCounts['Implemented'] || 0) / requirements.length * 100) : 0;
    console.log(`   Overall Implementation Rate: ${totalImplRate.toFixed(1)}%`);
}

if (require.main === module) {
    main();
}

module.exports = {
    RequirementExtractor,
    CodeAnalyzer,
    RequirementMatcher,
    CSVReportGenerator,
    ImplementationStatus
};
