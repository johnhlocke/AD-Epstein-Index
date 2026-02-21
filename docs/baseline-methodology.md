# Baseline Construction & Statistical Methodology

## For the AD-Epstein Aesthetic Index Comparison

**Dataset**: ~3,775 interior design features scored on 9 ordinal axes (1-5), grouped into SPACE / STORY / STAGE. Treatment group: ~75-84 Epstein-connected homes. Reference group: ~3,700 general AD features. Time span: 1988-2025.

---

## 1. Central Tendency Measure: Mean, Median, or Mode?

### Recommendation: Report the MEAN as the primary measure, with the MEDIAN as a robustness check.

### The Academic Debate

The question of whether means are appropriate for ordinal Likert-type data has been contentious for 80+ years. Two camps exist:

**The conservative position** (Stevens 1946; Jamieson 2004) holds that ordinal scales have no guarantee of equal intervals between points, and therefore only nonparametric summaries (median, mode) are permissible. Under strict measurement theory, "the distance between 1 and 2 is not necessarily the same as the distance between 4 and 5."

**The permissive position** (Norman 2010; Carifio & Perla 2008) demonstrates through extensive simulation that parametric statistics are remarkably robust to violations of the interval assumption. Norman's influential paper in *Advances in Health Sciences Education* reviewed evidence dating to the 1930s showing that parametric statistics "can be utilized without concern for 'getting the wrong answer'" even with ordinal data, small samples, non-normal distributions, and unequal variances.

### Why the Mean Is Right for This Project

1. **Our 1-5 scales have carefully calibrated anchors.** The aesthetic scoring instrument (v2) was developed through expert calibration with a licensed architect. The anchors at each point were designed to be approximately equidistant in perceptual terms -- this is precisely the methodology Osgood, Suci, & Tannenbaum (1957) used in their semantic differential scales.

2. **Sample size is large.** With n=3,775, the Central Limit Theorem ensures that sampling distributions of the mean will be approximately normal regardless of the underlying distribution shape.

3. **The mean is more sensitive to the differences we expect.** Our predicted Epstein signature involves shifts of 0.5-1.8 points on various axes. The median, being less sensitive to distributional shifts (especially on a 5-point scale where the median can only take 5 values), would mask precisely the differences we are trying to detect.

4. **Precedent in comparable studies.** Liu et al. (2019) in "Inside 50,000 Living Rooms" used mean prevalence rates for comparing decorative elements across cities. Bourdieu himself used geometric data analysis (multiple correspondence analysis) which operates on continuous coordinates derived from categorical data.

**However**, always report the median alongside the mean. If the mean and median diverge substantially for any axis, that signals skewness worth investigating.

### Key Citation
Norman, G. (2010). "Likert scales, levels of measurement and the 'laws' of statistics." *Advances in Health Sciences Education*, 15, 625-632.

---

## 2. Temporal Drift: Era-Adjusted Baseline

### Recommendation: YES. Use decade-band stratification as the primary approach, with era-adjusted z-scores as a sensitivity analysis.

### The Problem

AD's editorial aesthetic has demonstrably shifted across 37 years. The magazine's coverage in the late 1980s and 1990s skewed toward traditional, formal interiors (high Historicism, high Formality). By the 2010s-2020s, the editorial voice shifted toward mid-century modern, casual luxury, and diverse subject matter.

If the Epstein-connected homes cluster disproportionately in certain decades (which they likely do -- the Epstein social network was most active in the 1990s-2000s), then what looks like an "Epstein effect" could be partially or entirely a "decade effect."

### Recommended Approach: Era-Band Stratification

| Era Band | Years | Rationale |
|----------|-------|-----------|
| Late Cold War | 1988-1994 | Traditional AD, pre-digital |
| Millennial | 1995-2004 | Dot-com era, rising globalization |
| Pre-crash | 2005-2009 | Peak excess, pre-financial crisis |
| Post-crash | 2010-2015 | Austerity chic, Instagram nascent |
| Digital era | 2016-2025 | Instagram-dominant, diversity push |

For each Epstein-connected home, compare it against the baseline of **its own era band**, not the global mean.

### Sensitivity Analysis: Within-Era Z-Scores

Compute z-scores within each era band:

```
z_ij = (x_ij - mean_era(j)) / sd_era(j)
```

where x_ij is the score of feature i on axis j, and mean_era and sd_era are computed from all non-Epstein features in that feature's era band. Then compare the Epstein z-scores against zero.

### Alternative: Year as a Covariate

In a regression framework, include publication year (or era band) as a covariate. More statistically efficient than stratification but assumes a specific functional form for the temporal trend.

### What NOT To Do

Do not use rolling averages or time-series detrending (ARIMA, differencing). Those methods are for continuous time-series with autocorrelation. Our data is cross-sectional observations indexed by publication date.

### Key Citation
Schaie, K.W. (1965). "A general model for the study of developmental problems." *Psychological Bulletin*, 64(2), 92-107.
Rothman, K.J. et al. (2008). *Modern Epidemiology*, 3rd ed.

---

## 3. Exclude Epstein Subset from Baseline: YES

In case-control study design, **cases and controls must be mutually exclusive**. The standard practice in epidemiology is that the reference/control group consists of individuals "known to be free of the outcome."

With n=75-84 Epstein features out of ~3,775, the contamination is approximately 2%. This is small enough that including or excluding them barely moves the baseline mean. However, exclude them for methodological cleanliness -- any reviewer will question inclusion.

### Implementation

- **Baseline**: All features where `verdict != 'confirmed'` (n ~ 3,690-3,700)
- **Treatment**: All features where `verdict = 'confirmed'` (n ~ 75-84)
- Features with ambiguous verdicts (`likely_match`, `possible_match`, `needs_review`) should be **excluded from both groups** in the primary analysis, then included in a sensitivity analysis with the baseline.

### Key Citation
Wacholder, S., Silverman, D.T., McLaughlin, J.K., & Mandel, J.S. (1992). "Selection of controls in case-control studies." *American Journal of Epidemiology*, 135(9), 1019-1050.

---

## 4. Confounders: Stratification + Regression

### Recommendation: Use stratified analysis (era + subject category) as the primary approach, with Firth's penalized logistic regression as the multivariate sensitivity analysis. Propensity score matching is overkill at n=75-84.

### Potential Confounders

| Confounder | Why It Matters | How to Handle |
|------------|---------------|---------------|
| **Decade** | AD's editorial aesthetic shifted; Epstein network clustered in specific decades | Era-band stratification (Section 2) |
| **Subject category** | Socialites, financiers, celebrities may have different aesthetic profiles regardless of Epstein connection | Stratify or adjust |
| **Location** | Manhattan penthouses differ from LA compounds differ from Palm Beach mansions | Report but likely insufficient n per stratum |
| **Designer involvement** | Celebrity designers may cluster in the Epstein orbit | Report as descriptive finding; do not adjust away (may be part of the signal) |

### Why NOT Propensity Score Matching

1. **PSM is data-hungry.** Austin (2011) notes significant imbalances may be "unavoidable secondary to a small number of observations."
2. **Matching discards data.** 1:1 PSM throws away ~3,600 control observations.
3. **Few confounders.** With 2-3 key confounders, simple stratification is adequate.

### Recommended Multivariate Model

**Firth's penalized logistic regression** predicting Epstein_connected (0/1) from the 9 aesthetic scores, with era band as a covariate. Firth's method corrects for small-sample bias. With ~75 events and ~13 parameters, we have ~5-6 events per variable -- below EPV=10 but above the floor where logistic regression becomes unreliable.

### Key Citations
- Austin, P.C. (2011). "An Introduction to Propensity Score Methods." *Multivariate Behavioral Research*, 46(3), 399-424.
- Puhr, R. et al. (2017). "Firth's logistic regression with rare events." *Statistics in Medicine*.

---

## 5. Statistical Tests

### Primary Battery (Univariate, Per-Axis)

| Test | Purpose | Why |
|------|---------|-----|
| **Mann-Whitney U** | Significance | Standard nonparametric two-sample test for ordinal data. No distributional assumptions. |
| **Permutation test** | Robustness check | Shuffles labels 10,000+ times. Exact, assumption-free. |

### Effect Sizes (Univariate)

| Measure | Description | Thresholds |
|---------|-------------|-----------|
| **Cliff's delta** | P(Epstein > Baseline) - P(Epstein < Baseline). Primary nonparametric effect size. | \|d\| >= 0.11 small, >= 0.28 medium, >= 0.43 large |
| **Vargha-Delaney A** | P(stochastic superiority). Most intuitive. | A >= 0.56 small, >= 0.64 medium, >= 0.71 large |
| **Rank-biserial correlation** | Equivalent to Cliff's delta, on -1 to +1 scale. | Report alongside Cliff's delta |
| **Hedges' g** | Standardized mean difference (parametric sensitivity check). | 0.2 small, 0.5 medium, 0.8 large |

### Multiple Comparison Correction

**Benjamini-Hochberg FDR** (primary). Bonferroni is too conservative for 9 correlated tests. Report both raw, BH-adjusted, and Bonferroni-adjusted p-values.

### Multivariate Tests

| Test | Purpose |
|------|---------|
| **PERMANOVA** | Nonparametric MANOVA. Tests multivariate centroid difference. Gold standard for our data. |
| **Hotelling's T-squared** | Parametric multivariate complement. |
| **Firth's penalized logistic regression** | Per-axis odds ratios controlling for era. |
| **Linear Discriminant Analysis (LDA)** | Finds optimal separating combination. LOO cross-validation. |

### Key Citations
- Cliff, N. (1993). "Dominance statistics: Ordinal analyses to answer ordinal questions." *Psychological Bulletin*, 114(3), 494-509.
- Vargha, A. & Delaney, H.D. (2000). "A Critique and Improvement of the CL Common Language Effect Size Statistics." *JEEM*, 25(2), 101-132.
- Anderson, M.J. (2001). "A new method for non-parametric multivariate analysis of variance." *Austral Ecology*, 26(1), 32-46.

---

## 6. Composite Scores: Validity and Diagnostics

### Group Composites (SPACE, STORY, STAGE)

Valid **if** Cronbach's alpha > 0.60 for each group. With 3 items per group, alpha will be structurally low -- an inter-item correlation of r=0.40 yields alpha ~ 0.67. Compute alpha, report it, analyze axes individually if alpha < 0.60.

### Diagnostic Composite

Our predicted formula: `(Theatricality + Curation + Formality) - (Provenance + Material Warmth)`

This is theoretically grounded (cold performative luxury minus warm authentic living) with precedent in Heffetz (2011) who constructed a similar "visibility index" for conspicuous consumption.

**Validation via LDA**: The LDA discriminant weights are the empirically optimal composite. If they align with our theoretical formula, that's powerful validation. If they diverge, that's interesting data.

### Key Citations
- Heffetz, O. (2011). "A Test of Conspicuous Consumption: Visibility and Income Elasticities." *Review of Economics and Statistics*, 93(4), 1101-1117.
- Osgood, C.E., Suci, G.J., & Tannenbaum, P.H. (1957). *The Measurement of Meaning.* University of Illinois Press.

---

## 7. Visualization

| Visualization | Role | Notes |
|--------------|------|-------|
| **Forest plot of Cliff's delta with 95% CIs** | PRIMARY | Gold standard for multi-outcome effect sizes. 9 axes on y-axis, effect size on x-axis, vertical line at 0. |
| **Violin/box plots per axis** | Secondary | Full distribution shape, split by group. Consider jittered strip plots on 1-5 discrete scale. |
| **Radar chart** | Popular communication | Fine for website/social media but has documented perceptual problems (area distortion, axis ordering). Label as simplified view. |
| **Parallel coordinates** | Multivariate pattern | Shows Epstein group "corridor" through 9D space. Subsample baseline to avoid visual overload. |
| **Heatmap** | Era-stratified view | Compact matrix: axes x (Epstein/baseline per era band). |

### Precedent
- Liu et al. (2019): bar charts and heatmaps, no radar charts
- Meta-analyses: forest plots universally
- Bourdieu (1984): MCA biplot (2D taste-space scatterplot)

---

## 8. Precedent Studies

1. **Liu, L., Andris, C. et al. (2019).** "Inside 50,000 Living Rooms: An Assessment of Global Residential Ornamentation Using Transfer Learning." *EPJ Data Science*, 8, 4. -- Most directly comparable: ML-classified decorative elements compared across cities and socioeconomic strata.

2. **Bourdieu, P. (1984).** *Distinction: A Social Critique of the Judgement of Taste.* -- Foundational: quantified taste as function of social class using MCA on 1,217 subjects.

3. **Heffetz, O. (2011).** "A Test of Conspicuous Consumption: Visibility and Income Elasticities." *Review of Economics and Statistics*, 93(4). -- Constructed composite visibility index operationalizing Veblen's theory.

4. **Zheng, L. et al. (2023).** "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena." *NeurIPS 2023.* -- Validates LLM judges achieve >80% human agreement.

5. **Liu, Y. et al. (2023).** "G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment." *EMNLP 2023.* -- Structured rubric + chain-of-thought improves LLM scoring reliability.

6. **Kim, S. & Lee, S. (2020).** "Stochastic Detection of Interior Design Styles Using a Deep Learning Model." *Applied Sciences*, 10(20), 7299. -- Probabilistic multi-label style scoring for interiors.

7. **Trigg, A.B. (2001).** "Veblen, Bourdieu, and Conspicuous Consumption." *Journal of Economic Issues*, 35(1), 99-115. -- Bridges Veblen and Bourdieu frameworks.

8. **McPherson, M., Smith-Lovin, L., & Cook, J.M. (2001).** "Birds of a Feather: Homophily in Social Networks." *Annual Review of Sociology*, 27, 415-444. -- Theoretical grounding for aesthetic homophily in elite social networks.

---

## 9. Recommended Analysis Pipeline

### Step 1: Descriptive Statistics
- Per-axis: mean, median, SD, IQR, skewness (Epstein vs. baseline)
- Frequency table (proportion at each score 1-5)
- Cronbach's alpha for SPACE, STORY, STAGE groups

### Step 2: Univariate Axis-by-Axis Comparison
- Mann-Whitney U + permutation test (10K permutations)
- Effect sizes: Cliff's delta, Vargha-Delaney A, Hedges' g with 95% bootstrap CIs
- BH-corrected and Bonferroni-corrected p-values

### Step 3: Era-Stratified Comparison
- Repeat Step 2 within each era band
- Report whether effects survive era adjustment

### Step 4: Multivariate Tests
- PERMANOVA (Euclidean distance, 9,999 permutations)
- Hotelling's T-squared
- Firth's penalized logistic regression (9 axes + era_band)
- LDA with LOO cross-validation

### Step 5: Composite Score Analysis
- Group composites (if alpha > 0.60)
- Diagnostic composite: (Theatricality + Curation + Formality) - (Provenance + Material_Warmth)
- Compare LDA weights to theoretical formula

### Step 6: Visualization
- Forest plot of Cliff's delta with 95% CIs (primary)
- Violin plots per axis
- Radar chart (popular communication)

### Step 7: Sensitivity Analyses
- Include likely/possible matches in Epstein group
- Include Epstein in baseline (contamination check)
- Median instead of mean
- Remove post-2020 features

---

## Sources

- Norman, G. (2010). Likert scales, levels of measurement. *AHSE*, 15, 625-632.
- Cliff, N. (1993). Dominance statistics. *Psych Bulletin*, 114(3), 494-509.
- Vargha, A. & Delaney, H.D. (2000). CL effect size. *JEEM*, 25(2), 101-132.
- Anderson, M.J. (2001). Nonparametric MANOVA. *Austral Ecology*, 26(1), 32-46.
- Austin, P.C. (2011). Propensity score methods. *MBR*, 46(3), 399-424.
- Liu, L. et al. (2019). Inside 50,000 Living Rooms. *EPJ Data Science*, 8, 4.
- Heffetz, O. (2011). Conspicuous consumption. *REStat*, 93(4), 1101-1117.
- Zheng, L. et al. (2023). LLM-as-a-Judge. *NeurIPS 2023*.
- Liu, Y. et al. (2023). G-Eval. *EMNLP 2023*.
- Puhr, R. et al. (2017). Firth's logistic regression. *Statistics in Medicine*.
- Wacholder, S. et al. (1992). Selection of controls. *AJE*, 135(9), 1019-1050.
- Bourdieu, P. (1984). *Distinction*. Harvard University Press.
- Osgood, C.E. et al. (1957). *The Measurement of Meaning*. U of Illinois Press.
- McPherson, M. et al. (2001). Homophily in social networks. *ARS*, 27, 415-444.
