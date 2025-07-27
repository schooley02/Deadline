#!/usr/bin/env python3
"""
Automated Requirement-to-Code Alignment Diff Algorithm

This script analyzes project specification requirements and matches them to 
implementation evidence (selectors, functions, constants) in the codebase.
Outputs a status matrix CSV with alignment results.
"""

import os
import re
import csv
import json
import hashlib
from dataclasses import dataclass, field
from typing import List, Dict, Set, Tuple, Optional
from enum import Enum
from pathlib import Path

class ImplementationStatus(Enum):
    IMPLEMENTED = "Implemented"
    PARTIALLY_IMPLEMENTED = "Partially"
    MISSING = "Missing"
    INCONSISTENT = "Inconsistent"

@dataclass
class RequirementSpec:
    """Represents a single requirement from the specification"""
    id: str
    text: str
    category: str
    priority: str = "Medium"
    user_story: str = ""
    technical_details: List[str] = field(default_factory=list)
    acceptance_criteria: List[str] = field(default_factory=list)

@dataclass
class ImplementationEvidence:
    """Represents implementation evidence found in code"""
    file_path: str
    line_number: int
    code_type: str  # 'function', 'constant', 'selector', 'class', 'variable'
    name: str
    content: str
    context_lines: List[str] = field(default_factory=list)

@dataclass
class RequirementAlignment:
    """Represents the alignment between a requirement and its implementation"""
    requirement: RequirementSpec
    status: ImplementationStatus
    evidence: List[ImplementationEvidence] = field(default_factory=list)
    confidence_score: float = 0.0
    notes: str = ""
    coverage_percentage: float = 0.0

class RequirementExtractor:
    """Extracts structured requirements from project specification documents"""
    
    def __init__(self, spec_files: List[str]):
        self.spec_files = spec_files
        self.requirements = []
        
    def extract_requirements(self) -> List[RequirementSpec]:
        """Extract all requirements from specification files"""
        all_requirements = []
        
        for spec_file in self.spec_files:
            if os.path.exists(spec_file):
                requirements = self._parse_spec_file(spec_file)
                all_requirements.extend(requirements)
        
        # Deduplicate and assign IDs
        self.requirements = self._deduplicate_requirements(all_requirements)
        return self.requirements
    
    def _parse_spec_file(self, file_path: str) -> List[RequirementSpec]:
        """Parse a single specification file for requirements"""
        requirements = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract user stories (As a... I want... so that...)
        user_story_pattern = r'(?:^|\n)\* As a ([^,]+), I (?:want to |can |need to )?([^,]+?)(?:,?\s*so that (.+?))?(?=\n|$)'
        user_stories = re.findall(user_story_pattern, content, re.MULTILINE | re.IGNORECASE)
        
        for i, (user_type, action, benefit) in enumerate(user_stories):
            req_id = f"US_{hashlib.md5(f'{user_type}_{action}'.encode()).hexdigest()[:8]}"
            user_story_text = f"As a {user_type.strip()}, I {action.strip()}"
            if benefit:
                user_story_text += f" so that {benefit.strip()}"
                
            requirements.append(RequirementSpec(
                id=req_id,
                text=user_story_text,
                category="User Story",
                user_story=user_story_text,
                technical_details=self._extract_related_technical_details(content, action)
            ))
        
        # Extract feature requirements
        feature_sections = self._extract_feature_sections(content)
        for section_name, section_content in feature_sections.items():
            features = self._extract_features_from_section(section_content, section_name)
            requirements.extend(features)
        
        # Extract technical requirements
        tech_requirements = self._extract_technical_requirements(content)
        requirements.extend(tech_requirements)
        
        return requirements
    
    def _extract_feature_sections(self, content: str) -> Dict[str, str]:
        """Extract major feature sections from the specification"""
        sections = {}
        
        # Match section headers and their content
        section_pattern = r'^(#{1,3})\s*([^#\n]+?)(?=\n(?:#{1,3}|\Z))'
        matches = re.finditer(section_pattern, content, re.MULTILINE | re.DOTALL)
        
        current_section = None
        for match in matches:
            level = len(match.group(1))
            title = match.group(2).strip()
            
            # Filter for relevant feature sections
            if any(keyword in title.lower() for keyword in [
                'engine', 'system', 'management', 'mechanic', 'interface', 
                'progression', 'gameplay', 'feature'
            ]):
                # Extract the section content until next header of same or higher level
                start_pos = match.end()
                next_header_pattern = rf'\n#{{{1,{level}}}}\s'
                next_match = re.search(next_header_pattern, content[start_pos:])
                
                if next_match:
                    section_content = content[start_pos:start_pos + next_match.start()]
                else:
                    section_content = content[start_pos:]
                
                sections[title] = section_content.strip()
        
        return sections
    
    def _extract_features_from_section(self, section_content: str, section_name: str) -> List[RequirementSpec]:
        """Extract individual feature requirements from a section"""
        requirements = []
        
        # Extract bullet points as features
        feature_pattern = r'^\s*[*-]\s+(.+?)(?=\n\s*[*-]|\n\n|\Z)'
        features = re.findall(feature_pattern, section_content, re.MULTILINE | re.DOTALL)
        
        for i, feature_text in enumerate(features):
            feature_text = re.sub(r'\s+', ' ', feature_text.strip())
            if len(feature_text) > 10:  # Filter out very short items
                req_id = f"FT_{hashlib.md5(f'{section_name}_{feature_text[:50]}'.encode()).hexdigest()[:8]}"
                
                requirements.append(RequirementSpec(
                    id=req_id,
                    text=feature_text,
                    category=f"Feature - {section_name}",
                    technical_details=self._extract_technical_keywords(feature_text)
                ))
        
        return requirements
    
    def _extract_technical_requirements(self, content: str) -> List[RequirementSpec]:
        """Extract technical requirements and constraints"""
        requirements = []
        
        # Extract performance requirements
        perf_pattern = r'(?:performance|fps|speed|optimization|scalability)[:\s]*([^.\n]+)'
        perf_matches = re.findall(perf_pattern, content, re.IGNORECASE)
        
        for match in perf_matches:
            req_id = f"PERF_{hashlib.md5(match.encode()).hexdigest()[:8]}"
            requirements.append(RequirementSpec(
                id=req_id,
                text=f"Performance: {match.strip()}",
                category="Technical - Performance",
                priority="High"
            ))
        
        # Extract data requirements
        data_pattern = r'(?:storage|data|persistence|backup)[:\s]*([^.\n]+)'
        data_matches = re.findall(data_pattern, content, re.IGNORECASE)
        
        for match in data_matches:
            req_id = f"DATA_{hashlib.md5(match.encode()).hexdigest()[:8]}"
            requirements.append(RequirementSpec(
                id=req_id,
                text=f"Data: {match.strip()}",
                category="Technical - Data",
                priority="Medium"
            ))
        
        return requirements
    
    def _extract_technical_keywords(self, text: str) -> List[str]:
        """Extract technical implementation keywords from requirement text"""
        keywords = []
        
        # Common technical terms to look for
        tech_terms = [
            'click', 'button', 'form', 'input', 'display', 'animation', 'timer',
            'canvas', 'element', 'function', 'class', 'variable', 'event',
            'loop', 'interval', 'timeout', 'callback', 'listener', 'handler',
            'health', 'xp', 'points', 'level', 'enemy', 'base', 'attack',
            'task', 'habit', 'routine', 'completion', 'streak', 'category'
        ]
        
        text_lower = text.lower()
        for term in tech_terms:
            if term in text_lower:
                keywords.append(term)
        
        return keywords
    
    def _extract_related_technical_details(self, content: str, action: str) -> List[str]:
        """Find technical details related to a user story action"""
        details = []
        
        # Look for technical details in the same paragraph or nearby
        action_lower = action.lower()
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            if action_lower in line.lower():
                # Collect surrounding technical details
                start = max(0, i - 2)
                end = min(len(lines), i + 3)
                context = lines[start:end]
                
                for ctx_line in context:
                    if any(tech_word in ctx_line.lower() for tech_word in [
                        'function', 'class', 'element', 'button', 'form', 'api'
                    ]):
                        details.append(ctx_line.strip())
        
        return details
    
    def _deduplicate_requirements(self, requirements: List[RequirementSpec]) -> List[RequirementSpec]:
        """Remove duplicate requirements based on text similarity"""
        unique_requirements = []
        seen_texts = set()
        
        for req in requirements:
            # Create a normalized version for comparison
            normalized = re.sub(r'\s+', ' ', req.text.lower().strip())
            
            if normalized not in seen_texts and len(normalized) > 5:
                seen_texts.add(normalized)
                unique_requirements.append(req)
        
        return unique_requirements

class CodeAnalyzer:
    """Analyzes codebase to extract implementation evidence"""
    
    def __init__(self, code_directories: List[str], file_patterns: List[str] = None):
        self.code_directories = code_directories
        self.file_patterns = file_patterns or ['*.js', '*.html', '*.css', '*.py', '*.md']
        self.evidence = []
    
    def analyze_codebase(self) -> List[ImplementationEvidence]:
        """Analyze the codebase and extract implementation evidence"""
        evidence = []
        
        for directory in self.code_directories:
            if os.path.exists(directory):
                evidence.extend(self._analyze_directory(directory))
        
        self.evidence = evidence
        return evidence
    
    def _analyze_directory(self, directory: str) -> List[ImplementationEvidence]:
        """Analyze all files in a directory"""
        evidence = []
        
        for root, dirs, files in os.walk(directory):
            for file in files:
                if self._should_analyze_file(file):
                    file_path = os.path.join(root, file)
                    try:
                        file_evidence = self._analyze_file(file_path)
                        evidence.extend(file_evidence)
                    except Exception as e:
                        print(f"Error analyzing {file_path}: {e}")
        
        return evidence
    
    def _should_analyze_file(self, filename: str) -> bool:
        """Check if a file should be analyzed based on patterns"""
        if any(filename.endswith(ext) for ext in ['.js', '.html', '.css', '.py']):
            return True
        return False
    
    def _analyze_file(self, file_path: str) -> List[ImplementationEvidence]:
        """Analyze a single file for implementation evidence"""
        evidence = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
        except Exception:
            return evidence
        
        for i, line in enumerate(lines):
            line_evidence = self._analyze_line(file_path, i + 1, line, lines)
            evidence.extend(line_evidence)
        
        return evidence
    
    def _analyze_line(self, file_path: str, line_num: int, line: str, all_lines: List[str]) -> List[ImplementationEvidence]:
        """Analyze a single line for implementation evidence"""
        evidence = []
        line_strip = line.strip()
        
        # JavaScript function definitions
        if file_path.endswith('.js'):
            evidence.extend(self._extract_js_evidence(file_path, line_num, line, all_lines))
        
        # HTML elements and selectors
        elif file_path.endswith('.html'):
            evidence.extend(self._extract_html_evidence(file_path, line_num, line, all_lines))
        
        # CSS selectors and classes
        elif file_path.endswith('.css'):
            evidence.extend(self._extract_css_evidence(file_path, line_num, line, all_lines))
        
        # Python functions and classes
        elif file_path.endswith('.py'):
            evidence.extend(self._extract_python_evidence(file_path, line_num, line, all_lines))
        
        return evidence
    
    def _extract_js_evidence(self, file_path: str, line_num: int, line: str, all_lines: List[str]) -> List[ImplementationEvidence]:
        """Extract JavaScript implementation evidence"""
        evidence = []
        line_strip = line.strip()
        
        # Function declarations
        func_patterns = [
            r'function\s+(\w+)\s*\(',
            r'const\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>)',
            r'let\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>)',
            r'(\w+):\s*function\s*\(',
            r'(\w+)\s*\([^)]*\)\s*{',
        ]
        
        for pattern in func_patterns:
            matches = re.finditer(pattern, line)
            for match in matches:
                func_name = match.group(1)
                evidence.append(ImplementationEvidence(
                    file_path=file_path,
                    line_number=line_num,
                    code_type='function',
                    name=func_name,
                    content=line_strip,
                    context_lines=self._get_context_lines(all_lines, line_num, 2)
                ))
        
        # Constants and variables
        const_patterns = [
            r'const\s+([A-Z_][A-Z0-9_]*)\s*=',
            r'let\s+([a-zA-Z_]\w*)',
            r'var\s+([a-zA-Z_]\w*)'
        ]
        
        for pattern in const_patterns:
            matches = re.finditer(pattern, line)
            for match in matches:
                var_name = match.group(1)
                evidence.append(ImplementationEvidence(
                    file_path=file_path,
                    line_number=line_num,
                    code_type='constant' if var_name.isupper() else 'variable',
                    name=var_name,
                    content=line_strip,
                    context_lines=self._get_context_lines(all_lines, line_num, 1)
                ))
        
        # Event listeners and DOM selectors
        selector_patterns = [
            r'getElementById\([\'"]([^\'"]+)[\'"]\)',
            r'querySelector\([\'"]([^\'"]+)[\'"]\)',
            r'getElementsByClassName\([\'"]([^\'"]+)[\'"]\)',
        ]
        
        for pattern in selector_patterns:
            matches = re.finditer(pattern, line)
            for match in matches:
                selector = match.group(1)
                evidence.append(ImplementationEvidence(
                    file_path=file_path,
                    line_number=line_num,
                    code_type='selector',
                    name=selector,
                    content=line_strip,
                    context_lines=self._get_context_lines(all_lines, line_num, 1)
                ))
        
        return evidence
    
    def _extract_html_evidence(self, file_path: str, line_num: int, line: str, all_lines: List[str]) -> List[ImplementationEvidence]:
        """Extract HTML implementation evidence"""
        evidence = []
        
        # HTML elements with IDs
        id_pattern = r'<(\w+)[^>]*id=[\'"]([^\'"]+)[\'"][^>]*>'
        matches = re.finditer(id_pattern, line)
        for match in matches:
            element_type = match.group(1)
            element_id = match.group(2)
            evidence.append(ImplementationEvidence(
                file_path=file_path,
                line_number=line_num,
                code_type='selector',
                name=element_id,
                content=line.strip(),
                context_lines=self._get_context_lines(all_lines, line_num, 1)
            ))
        
        # HTML elements with classes
        class_pattern = r'<(\w+)[^>]*class=[\'"]([^\'"]+)[\'"][^>]*>'
        matches = re.finditer(class_pattern, line)
        for match in matches:
            element_type = match.group(1)
            classes = match.group(2).split()
            for class_name in classes:
                evidence.append(ImplementationEvidence(
                    file_path=file_path,
                    line_number=line_num,
                    code_type='selector',
                    name=class_name,
                    content=line.strip(),
                    context_lines=self._get_context_lines(all_lines, line_num, 1)
                ))
        
        return evidence
    
    def _extract_css_evidence(self, file_path: str, line_num: int, line: str, all_lines: List[str]) -> List[ImplementationEvidence]:
        """Extract CSS implementation evidence"""
        evidence = []
        
        # CSS class and ID selectors
        selector_pattern = r'([.#]?[\w-]+)\s*{'
        matches = re.finditer(selector_pattern, line)
        for match in matches:
            selector = match.group(1)
            evidence.append(ImplementationEvidence(
                file_path=file_path,
                line_number=line_num,
                code_type='selector',
                name=selector,
                content=line.strip(),
                context_lines=self._get_context_lines(all_lines, line_num, 1)
            ))
        
        return evidence
    
    def _extract_python_evidence(self, file_path: str, line_num: int, line: str, all_lines: List[str]) -> List[ImplementationEvidence]:
        """Extract Python implementation evidence"""
        evidence = []
        
        # Function definitions
        func_pattern = r'def\s+(\w+)\s*\('
        matches = re.finditer(func_pattern, line)
        for match in matches:
            func_name = match.group(1)
            evidence.append(ImplementationEvidence(
                file_path=file_path,
                line_number=line_num,
                code_type='function',
                name=func_name,
                content=line.strip(),
                context_lines=self._get_context_lines(all_lines, line_num, 2)
            ))
        
        # Class definitions
        class_pattern = r'class\s+(\w+)\s*(?:\([^)]*\))?:'
        matches = re.finditer(class_pattern, line)
        for match in matches:
            class_name = match.group(1)
            evidence.append(ImplementationEvidence(
                file_path=file_path,
                line_number=line_num,
                code_type='class',
                name=class_name,
                content=line.strip(),
                context_lines=self._get_context_lines(all_lines, line_num, 2)
            ))
        
        return evidence
    
    def _get_context_lines(self, all_lines: List[str], line_num: int, context_size: int = 2) -> List[str]:
        """Get context lines around the current line"""
        start = max(0, line_num - context_size - 1)
        end = min(len(all_lines), line_num + context_size)
        return [line.strip() for line in all_lines[start:end]]

class RequirementMatcher:
    """Matches requirements to implementation evidence using various algorithms"""
    
    def __init__(self, requirements: List[RequirementSpec], evidence: List[ImplementationEvidence]):
        self.requirements = requirements
        self.evidence = evidence
        self.alignments = []
    
    def match_requirements_to_evidence(self) -> List[RequirementAlignment]:
        """Match all requirements to implementation evidence"""
        alignments = []
        
        for requirement in self.requirements:
            alignment = self._match_single_requirement(requirement)
            alignments.append(alignment)
        
        self.alignments = alignments
        return alignments
    
    def _match_single_requirement(self, requirement: RequirementSpec) -> RequirementAlignment:
        """Match a single requirement to evidence"""
        matched_evidence = []
        
        # Extract keywords from requirement
        keywords = self._extract_keywords_from_requirement(requirement)
        
        # Score each piece of evidence against the requirement
        evidence_scores = []
        for evidence in self.evidence:
            score = self._calculate_evidence_score(requirement, evidence, keywords)
            if score > 0.3:  # Threshold for relevance
                evidence_scores.append((evidence, score))
        
        # Sort by score and take the best matches
        evidence_scores.sort(key=lambda x: x[1], reverse=True)
        matched_evidence = [ev for ev, score in evidence_scores[:10]]  # Top 10 matches
        
        # Determine implementation status
        status = self._determine_implementation_status(requirement, matched_evidence)
        
        # Calculate confidence and coverage
        confidence = self._calculate_confidence_score(requirement, matched_evidence)
        coverage = self._calculate_coverage_percentage(requirement, matched_evidence)
        
        return RequirementAlignment(
            requirement=requirement,
            status=status,
            evidence=matched_evidence,
            confidence_score=confidence,
            coverage_percentage=coverage,
            notes=self._generate_alignment_notes(requirement, matched_evidence, status)
        )
    
    def _extract_keywords_from_requirement(self, requirement: RequirementSpec) -> List[str]:
        """Extract searchable keywords from a requirement"""
        keywords = []
        
        # Extract from requirement text
        text = requirement.text.lower()
        
        # Common domain-specific keywords
        domain_keywords = {
            'task': ['task', 'item', 'todo', 'deadline', 'due'],
            'habit': ['habit', 'routine', 'daily', 'streak', 'completion'],
            'game': ['enemy', 'zombie', 'base', 'health', 'attack', 'defeat'],
            'ui': ['button', 'form', 'input', 'display', 'click', 'element'],
            'progression': ['xp', 'level', 'points', 'upgrade', 'unlock']
        }
        
        # Add domain keywords found in requirement
        for domain, words in domain_keywords.items():
            for word in words:
                if word in text:
                    keywords.extend(words)
                    break
        
        # Extract nouns and verbs
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text)
        keywords.extend([word.lower() for word in words if len(word) > 3])
        
        # Add technical details
        keywords.extend(requirement.technical_details)
        
        # Remove duplicates and filter
        keywords = list(set(keywords))
        keywords = [k for k in keywords if len(k) > 2]
        
        return keywords
    
    def _calculate_evidence_score(self, requirement: RequirementSpec, evidence: ImplementationEvidence, keywords: List[str]) -> float:
        """Calculate how well a piece of evidence matches a requirement"""
        score = 0.0
        
        # Direct keyword matching
        evidence_text = f"{evidence.name} {evidence.content}".lower()
        keyword_matches = sum(1 for keyword in keywords if keyword in evidence_text)
        
        if keywords:
            keyword_score = keyword_matches / len(keywords)
            score += keyword_score * 0.4
        
        # Name similarity
        name_similarity = self._calculate_name_similarity(requirement.text, evidence.name)
        score += name_similarity * 0.3
        
        # Code type relevance
        type_relevance = self._calculate_type_relevance(requirement, evidence)
        score += type_relevance * 0.2
        
        # Context matching
        context_text = ' '.join(evidence.context_lines).lower()
        context_matches = sum(1 for keyword in keywords if keyword in context_text)
        if keywords:
            context_score = context_matches / len(keywords)
            score += context_score * 0.1
        
        return min(score, 1.0)
    
    def _calculate_name_similarity(self, requirement_text: str, evidence_name: str) -> float:
        """Calculate similarity between requirement text and evidence name"""
        req_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', requirement_text.lower()))
        evidence_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', evidence_name.lower()))
        
        if not req_words:
            return 0.0
        
        intersection = req_words.intersection(evidence_words)
        return len(intersection) / len(req_words)
    
    def _calculate_type_relevance(self, requirement: RequirementSpec, evidence: ImplementationEvidence) -> float:
        """Calculate how relevant the evidence type is to the requirement"""
        type_relevance_map = {
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
        }
        
        category_key = requirement.category.split(' - ')[0] if ' - ' in requirement.category else requirement.category
        
        if category_key in type_relevance_map:
            return type_relevance_map[category_key].get(evidence.code_type, 0.3)
        
        return 0.5  # Default relevance
    
    def _determine_implementation_status(self, requirement: RequirementSpec, evidence: List[ImplementationEvidence]) -> ImplementationStatus:
        """Determine the implementation status based on evidence"""
        if not evidence:
            return ImplementationStatus.MISSING
        
        # Calculate average confidence of evidence
        total_keywords = len(self._extract_keywords_from_requirement(requirement))
        if total_keywords == 0:
            return ImplementationStatus.MISSING
        
        # Count evidence types
        evidence_types = set(ev.code_type for ev in evidence)
        evidence_count = len(evidence)
        
        # Determine status based on evidence quantity and quality
        if evidence_count >= 3 and len(evidence_types) >= 2:
            return ImplementationStatus.IMPLEMENTED
        elif evidence_count >= 1 and len(evidence_types) >= 1:
            return ImplementationStatus.PARTIALLY_IMPLEMENTED
        elif evidence_count > 0:
            # Check if evidence seems contradictory
            names = [ev.name for ev in evidence]
            if len(set(names)) > evidence_count * 0.8:  # High name diversity might indicate confusion
                return ImplementationStatus.INCONSISTENT
            return ImplementationStatus.PARTIALLY_IMPLEMENTED
        else:
            return ImplementationStatus.MISSING
    
    def _calculate_confidence_score(self, requirement: RequirementSpec, evidence: List[ImplementationEvidence]) -> float:
        """Calculate confidence in the alignment"""
        if not evidence:
            return 0.0
        
        keywords = self._extract_keywords_from_requirement(requirement)
        if not keywords:
            return 0.3
        
        # Average evidence scores
        total_score = 0.0
        for ev in evidence:
            score = self._calculate_evidence_score(requirement, ev, keywords)
            total_score += score
        
        avg_score = total_score / len(evidence)
        
        # Boost confidence if multiple evidence types
        evidence_types = len(set(ev.code_type for ev in evidence))
        type_bonus = min(evidence_types * 0.1, 0.3)
        
        return min(avg_score + type_bonus, 1.0)
    
    def _calculate_coverage_percentage(self, requirement: RequirementSpec, evidence: List[ImplementationEvidence]) -> float:
        """Calculate what percentage of the requirement is covered"""
        keywords = self._extract_keywords_from_requirement(requirement)
        if not keywords:
            return 0.0 if not evidence else 50.0
        
        covered_keywords = set()
        for ev in evidence:
            evidence_text = f"{ev.name} {ev.content}".lower()
            for keyword in keywords:
                if keyword in evidence_text:
                    covered_keywords.add(keyword)
        
        return (len(covered_keywords) / len(keywords)) * 100
    
    def _generate_alignment_notes(self, requirement: RequirementSpec, evidence: List[ImplementationEvidence], status: ImplementationStatus) -> str:
        """Generate notes about the alignment"""
        notes = []
        
        if status == ImplementationStatus.IMPLEMENTED:
            evidence_types = set(ev.code_type for ev in evidence)
            notes.append(f"Found {len(evidence)} pieces of evidence across {len(evidence_types)} code types")
            
            if evidence:
                main_files = set(os.path.basename(ev.file_path) for ev in evidence[:3])
                notes.append(f"Primary implementation in: {', '.join(main_files)}")
        
        elif status == ImplementationStatus.PARTIALLY_IMPLEMENTED:
            notes.append("Partial implementation detected")
            if evidence:
                notes.append(f"Found evidence in {evidence[0].code_type}: {evidence[0].name}")
        
        elif status == ImplementationStatus.MISSING:
            keywords = self._extract_keywords_from_requirement(requirement)
            if keywords:
                notes.append(f"No evidence found for key terms: {', '.join(keywords[:3])}")
            else:
                notes.append("Requirement text lacks specific implementation keywords")
        
        elif status == ImplementationStatus.INCONSISTENT:
            notes.append("Conflicting or unclear evidence found")
            if evidence:
                names = [ev.name for ev in evidence[:3]]
                notes.append(f"Multiple implementations: {', '.join(names)}")
        
        return '; '.join(notes)

class CSVReportGenerator:
    """Generates CSV reports for requirement alignments"""
    
    def __init__(self, alignments: List[RequirementAlignment]):
        self.alignments = alignments
    
    def generate_matrix_csv(self, output_file: str = "requirement_alignment_matrix.csv"):
        """Generate the main alignment matrix CSV"""
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'Requirement_ID', 'Requirement_Text', 'Category', 'Priority',
                'Status', 'Confidence_Score', 'Coverage_Percentage',
                'Evidence_Count', 'Evidence_Types', 'Implementation_Files',
                'Key_Functions', 'Key_Selectors', 'Key_Constants',
                'Notes', 'User_Story'
            ]
            
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for alignment in self.alignments:
                # Group evidence by type
                evidence_by_type = {}
                for evidence in alignment.evidence:
                    if evidence.code_type not in evidence_by_type:
                        evidence_by_type[evidence.code_type] = []
                    evidence_by_type[evidence.code_type].append(evidence)
                
                # Extract file names
                files = list(set(os.path.basename(ev.file_path) for ev in alignment.evidence))
                
                writer.writerow({
                    'Requirement_ID': alignment.requirement.id,
                    'Requirement_Text': alignment.requirement.text[:200] + ('...' if len(alignment.requirement.text) > 200 else ''),
                    'Category': alignment.requirement.category,
                    'Priority': alignment.requirement.priority,
                    'Status': alignment.status.value,
                    'Confidence_Score': f"{alignment.confidence_score:.2f}",
                    'Coverage_Percentage': f"{alignment.coverage_percentage:.1f}%",
                    'Evidence_Count': len(alignment.evidence),
                    'Evidence_Types': ', '.join(evidence_by_type.keys()),
                    'Implementation_Files': ', '.join(files[:3]),  # Top 3 files
                    'Key_Functions': ', '.join([ev.name for ev in evidence_by_type.get('function', [])][:3]),
                    'Key_Selectors': ', '.join([ev.name for ev in evidence_by_type.get('selector', [])][:3]),
                    'Key_Constants': ', '.join([ev.name for ev in evidence_by_type.get('constant', [])][:3]),
                    'Notes': alignment.notes,
                    'User_Story': alignment.requirement.user_story
                })
    
    def generate_detailed_evidence_csv(self, output_file: str = "detailed_evidence.csv"):
        """Generate detailed evidence CSV"""
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'Requirement_ID', 'Evidence_File', 'Evidence_Line', 'Evidence_Type',
                'Evidence_Name', 'Evidence_Content', 'Match_Score'
            ]
            
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for alignment in self.alignments:
                keywords = self._extract_keywords_from_alignment(alignment)
                
                for evidence in alignment.evidence:
                    # Calculate individual match score
                    score = self._calculate_evidence_score_for_requirement(alignment.requirement, evidence, keywords)
                    
                    writer.writerow({
                        'Requirement_ID': alignment.requirement.id,
                        'Evidence_File': evidence.file_path,
                        'Evidence_Line': evidence.line_number,
                        'Evidence_Type': evidence.code_type,
                        'Evidence_Name': evidence.name,
                        'Evidence_Content': evidence.content[:100] + ('...' if len(evidence.content) > 100 else ''),
                        'Match_Score': f"{score:.3f}"
                    })
    
    def generate_summary_csv(self, output_file: str = "alignment_summary.csv"):
        """Generate summary statistics CSV"""
        status_counts = {}
        category_stats = {}
        
        for alignment in self.alignments:
            # Count by status
            status = alignment.status.value
            if status not in status_counts:
                status_counts[status] = 0
            status_counts[status] += 1
            
            # Count by category
            category = alignment.requirement.category
            if category not in category_stats:
                category_stats[category] = {
                    'total': 0, 'implemented': 0, 'partially': 0, 
                    'missing': 0, 'inconsistent': 0
                }
            
            category_stats[category]['total'] += 1
            
            if status == 'Implemented':
                category_stats[category]['implemented'] += 1
            elif status == 'Partially':
                category_stats[category]['partially'] += 1
            elif status == 'Missing':
                category_stats[category]['missing'] += 1
            elif status == 'Inconsistent':
                category_stats[category]['inconsistent'] += 1
        
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'Metric', 'Category', 'Implemented', 'Partially', 
                'Missing', 'Inconsistent', 'Total', 'Implementation_Rate'
            ]
            
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            # Overall summary
            total_reqs = len(self.alignments)
            implemented = status_counts.get('Implemented', 0)
            impl_rate = (implemented / total_reqs * 100) if total_reqs > 0 else 0
            
            writer.writerow({
                'Metric': 'Overall',
                'Category': 'All Requirements',
                'Implemented': status_counts.get('Implemented', 0),
                'Partially': status_counts.get('Partially', 0),
                'Missing': status_counts.get('Missing', 0),
                'Inconsistent': status_counts.get('Inconsistent', 0),
                'Total': total_reqs,
                'Implementation_Rate': f"{impl_rate:.1f}%"
            })
            
            # Category breakdowns
            for category, stats in category_stats.items():
                impl_rate = (stats['implemented'] / stats['total'] * 100) if stats['total'] > 0 else 0
                writer.writerow({
                    'Metric': 'Category',
                    'Category': category,
                    'Implemented': stats['implemented'],
                    'Partially': stats['partially'],
                    'Missing': stats['missing'],
                    'Inconsistent': stats['inconsistent'],
                    'Total': stats['total'],
                    'Implementation_Rate': f"{impl_rate:.1f}%"
                })
    
    def _extract_keywords_from_alignment(self, alignment: RequirementAlignment) -> List[str]:
        """Helper method to extract keywords for detailed evidence scoring"""
        text = alignment.requirement.text.lower()
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text)
        return [word.lower() for word in words if len(word) > 3]
    
    def _calculate_evidence_score_for_requirement(self, requirement: RequirementSpec, evidence: ImplementationEvidence, keywords: List[str]) -> float:
        """Helper method to calculate evidence score (simplified version)"""
        evidence_text = f"{evidence.name} {evidence.content}".lower()
        keyword_matches = sum(1 for keyword in keywords if keyword in evidence_text)
        
        if keywords:
            return keyword_matches / len(keywords)
        return 0.5

def main():
    """Main execution function"""
    print("🔍 Starting Requirement-to-Code Alignment Analysis...")
    
    # Configuration
    spec_files = [
        "./PROJECT_SPEC.md",
        "./shared_workspace/01_PROJECT_SPEC.md",
        "./IMPLEMENTATION_MANIFEST.md"
    ]
    
    code_directories = [
        ".",
        "./shared_workspace",
        "./Deadline-MPE"
    ]
    
    # Step 1: Extract Requirements
    print("📋 Extracting requirements from specifications...")
    req_extractor = RequirementExtractor(spec_files)
    requirements = req_extractor.extract_requirements()
    print(f"   Found {len(requirements)} requirements")
    
    # Step 2: Analyze Codebase
    print("🔬 Analyzing codebase for implementation evidence...")
    code_analyzer = CodeAnalyzer(code_directories)
    evidence = code_analyzer.analyze_codebase()
    print(f"   Found {len(evidence)} pieces of evidence")
    
    # Step 3: Match Requirements to Evidence
    print("🎯 Matching requirements to implementation evidence...")
    matcher = RequirementMatcher(requirements, evidence)
    alignments = matcher.match_requirements_to_evidence()
    
    # Calculate summary statistics
    status_counts = {}
    for alignment in alignments:
        status = alignment.status.value
        status_counts[status] = status_counts.get(status, 0) + 1
    
    print(f"   ✅ Implemented: {status_counts.get('Implemented', 0)}")
    print(f"   🔄 Partially: {status_counts.get('Partially', 0)}")
    print(f"   ❌ Missing: {status_counts.get('Missing', 0)}")
    print(f"   ⚠️  Inconsistent: {status_counts.get('Inconsistent', 0)}")
    
    # Step 4: Generate CSV Reports
    print("📊 Generating CSV reports...")
    report_generator = CSVReportGenerator(alignments)
    
    # Generate main matrix
    report_generator.generate_matrix_csv()
    print("   📄 Generated: requirement_alignment_matrix.csv")
    
    # Generate detailed evidence
    report_generator.generate_detailed_evidence_csv()
    print("   📄 Generated: detailed_evidence.csv")
    
    # Generate summary
    report_generator.generate_summary_csv()
    print("   📄 Generated: alignment_summary.csv")
    
    print("\n🎉 Analysis complete! Check the generated CSV files for detailed results.")
    
    # Display top findings
    print("\n📈 Top Implementation Gaps:")
    missing_reqs = [a for a in alignments if a.status == ImplementationStatus.MISSING]
    for req in missing_reqs[:5]:
        print(f"   • {req.requirement.id}: {req.requirement.text[:80]}...")
    
    print(f"\n🔍 Analysis Summary:")
    print(f"   Total Requirements: {len(requirements)}")
    print(f"   Total Evidence: {len(evidence)}")
    total_impl_rate = (status_counts.get('Implemented', 0) / len(requirements) * 100) if requirements else 0
    print(f"   Overall Implementation Rate: {total_impl_rate:.1f}%")

if __name__ == "__main__":
    main()
