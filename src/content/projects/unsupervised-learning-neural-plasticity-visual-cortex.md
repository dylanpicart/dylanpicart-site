---
title: "Encoding and Decoding Behavioral Signals in Mouse Visual Cortex: A GLM Study Across Learning Stages"
description: "Fitting Generalized Linear Models to 50,000+ neuron recordings across V1 and higher visual areas of the mouse visual cortex to decode behavioral variables — lick, reward, cue, velocity, and texture — across supervised and unsupervised learning stages, extending Zhong et al. (Nature, 2025)."
date: 2025-09-20
langs: [Python]
tags: ["Computational Neuroscience", "GLM", "Research", "Neuromatch"]
published: true
featured: false
section: research
---

**Neuromatch Academy — Computational Neuroscience 2025 · Group A**  
**Team: K. Kumar (TA), S. Rezvani (TA), D. Picart, M. Hemmati, S. Elhassa, C. Bayar, R. Nathaniel, A. Oladokun, N. Karimova, M. Finch, Y. Ouattara · Mentor: B. Mohar**

---

## The Question

How do different regions of the mouse visual cortex encode and decode behavior — and does that differ across brain regions, across learning stages, and between animals who receive rewards and those who don't?

This work extends **Zhong et al. (Nature, 2025)**, who recorded nearly 50,000+ neurons across V1 and higher visual areas (HVAs) during a virtual reality task and found that stimulus-driven plasticity persists even without explicit reward. Our team fit Generalized Linear Models to these recordings to ask a more targeted question:

> Which behavioral variables drive neural activity in each region — and which regions' activity can predict behavior back?

---

## The Experiment

Mice navigated virtual-reality corridors textured with natural images (circle and leaf patterns). An auditory cue signaled a potential reward zone. The **supervised group** received a water reward following the cue; the **unsupervised group** experienced identical stimuli without reward.

Neural activity from 50,000+ neurons across four visual cortical regions was recorded simultaneously using a two-photon mesoscope:

- **V1** — primary visual cortex
- **mHV** — medial higher visual area
- **lHV** — lateral higher visual area
- **aHV** — anterior higher visual area

We analyzed recordings **before and after learning** for both groups, giving us eight conditions per region to compare.

---

## The GLMs: Two Directions

We built two complementary models, each asking the question in the opposite direction:

**Encoding Model (Behavior → Neural Activity)**  
For every neuron in every brain region, fit a separate GLM predicting neural firing from five behavioral variables. The learned weights tell us how strongly each behavior drives that neuron's activity.

**Decoding Model (Neural Activity → Behavior)**  
Use population activity from each region to predict behavioral outcomes. This tells us how much information about behavior is encoded in the population code.

The five behavioral variables:

| Variable | Description |
|---|---|
| Velocity | Running speed of the animal |
| Lick | Binary lick events (behavioral output) |
| Reward | Reward delivery events |
| Cue | Auditory cue onset |
| Track | Corridor texture (textured vs. smooth; first 40 of 60 position bins) |

To handle the scale of the data, we selected 1,000 randomly sampled neurons from each brain region (seeded for reproducibility) and flattened neural activity and behavioral data into 2D arrays conforming to GLM input requirements.

```python
def fit_GLM(behavioral_correlates, neuron_activity_flat, regression='ridge'):
    """Fit per-neuron GLM predicting activity from behavioral variables.
    
    behavioral_correlates: (n_variables, n_timepoints) design matrix
    neuron_activity_flat:  (n_timepoints,) target firing rate
    """
    design_matrix_X = behavioral_correlates.T  # (n_timepoints, n_variables)
    
    if regression == 'ridge':
        model = RidgeCV()
    elif regression == 'lasso':
        model = LassoCV(cv=5)
    
    model.fit(design_matrix_X, neuron_activity_flat)
    predicted_activity = model.predict(design_matrix_X)
    mse = mean_squared_error(neuron_activity_flat, predicted_activity)
    
    return {
        "weights": model.coef_,        # one weight per behavioral variable
        "predicted_activity": predicted_activity,
        "mse": mse,
    }
```

---

## Key Finding 1 — aHV is Least Responsive to Visual Stimuli

The encoding model's track texture weights tell the clearest story. Track texture (the corridor's visual pattern) should drive primary visual cortex — and it does. But as we move into higher visual areas, the picture changes.

![Encoding Model — Mean Weights Show Absence of Positive Weight on Track Texture in aHV. V1 and mHV show clear positive track texture weights (green circles); aHV before and after shows near-zero or negative weights (red circles).](/images/compneuro-slide-encoding-weights.jpg)

![Track Coefficient Across Brain Regions (before vs. after learning). Left: aHV track GLM weight is near zero — circled in red — while V1, mHV, and lHV are clearly positive. Right: scatter of all GLM coefficients per region shows aHV's markedly flatter distribution for textured bins.](/images/compneuro-slide-track-sensitivity.jpg)

**aHV consistently showed the lowest track texture weights across all conditions** — before and after learning, supervised and unsupervised. While V1, mHV, and lHV all showed meaningful texture encoding, aHV's responses were systematically weaker. MSE reconstruction loss confirmed this: removing the track texture predictor hurt V1's predictions substantially, but the loss reduction in aHV was the smallest of all four regions.

![GLM MSE Loss Excluding Track vs Other Variables. V1 shows the largest delta MSE (~0.12) when track texture is removed; aHV shows the smallest (~0.025), confirming track texture contributes least to aHV's reconstruction.](/images/compneuro-slide-mse-track.jpg)

This finding aligns with aHV's known role in processing higher-order contextual and reward-related information rather than low-level visual features. aHV is not ignoring the visual input — it is processing something else.

```python
def compare_weights_across_regions(GLM_data_dicts, regions, variable_idx=4):
    """Compare a single variable's weight across brain regions.
    
    variable_idx=4 is the track texture variable.
    """
    for region, GLM_data_dict in zip(regions, GLM_data_dicts):
        track_weights = [
            GLM_data_dict[neuron]["weights"][variable_idx]
            for neuron in GLM_data_dict
        ]
        mean_w = np.mean(track_weights)
        sem_w  = sem(track_weights)
        print(f"{region}: mean track weight = {mean_w:.4f} ± {sem_w:.4f}")
```

---

## Key Finding 2 — All Regions Decode Behavior Equally Well, Except aHV

The decoding model told the complementary story. We fit logistic regression classifiers from population activity to predict each behavioral variable — lick, reward, cue, and track texture — for each region, before and after learning.

For lick, reward, and cue: **all four brain regions predicted behavioral outcomes with comparable accuracy.** Even aHV's population activity contained sufficient information to decode these behavioral variables. Population codes for behavioral outputs are distributed across the visual cortex, not localized to V1.

The exception: **aHV performed worst at predicting track texture** — consistent with the encoding result. The region simply carries less visual texture information, so its population can't decode it as well as V1 or the other HVAs.

This double dissociation — aHV encodes behavioral variables (lick, reward, cue) but not texture; V1 encodes texture but encodes behavioral variables equally well — suggests that the visual hierarchy isn't just a feedforward feature detector. Higher areas are integrating contextual, behavioral, and potentially reward-related signals that primary cortex doesn't weight as heavily.

---

![Main Findings and Conclusion. Decoding Model: aHV activity is less responsive to visual stimuli compared to V1 and other higher visual regions (low track texture weight). Encoding Model: Neural activity from all brain regions equally predicts behavioral outcomes (Lick, Reward, Cue Location) except for aHV, which performs worst at predicting track texture. Conclusion: aHV encodes visual stimuli differently from other visual brain regions.](/images/compneuro-slide-findings.jpg)

## Effect of Learning

Comparing before-learning and after-learning conditions:

- **Encoding weights shifted** across all regions for lick and reward variables — neural representations reorganized with learning
- **The texture weight deficit in aHV persisted** across learning stages, suggesting this is a structural property of aHV's role, not a transient feature of the naive animal
- **The unsupervised group showed similar reorganization** on sensory variables, confirming Zhong et al.'s finding that stimulus-driven plasticity doesn't require reward

---

## Impact Scholars Proposal — Dynamics of Reward Anticipation and Prediction Error in the Mouse Visual Cortex

*Proposed by C. Bayar, N. Karimova, R. Nathaniel, and D. Picart; Neuromatch Academy Impact Scholar Program, September 2025.*

When expecting an important email, you may find yourself constantly checking notifications or repeatedly reloading the page. Anticipatory behaviors — actions performed in advance of an expectation — are a window into how the brain integrates top-down expectations with bottom-up sensory input. Our proposed research investigates how neural activity patterns differ between correct and error trials in the context of reward anticipation, and what those differences reveal about the dynamics and neural encoding of prediction error (PE) signals.

The starting point is our NMA finding: aHVAs appeared less stimulus-responsive, but that conclusion assumed static stimulus decoders. Our proposal reframes it as a testable computational specialization — **aHVAs may serve as the predictive control center for anticipation and PE, rather than sensory feature encoders.** The "aHVAs are less stimulus-responsive" observation becomes: aHVAs preferentially encode internal variables (anticipation, PE) over external features (texture), precisely because they are positioned higher in the cortical hierarchy.

### Three Hypotheses

**Hypothesis 1 — Prediction error reduces with learning.** With repeated reward experience, neural circuits involved in action selection should exhibit a reduction in PE signaling, consistent with reinforcement-driven updating of internal models.

**Hypothesis 2 — Pre-lick activity reflects expected value.** Neural activity preceding licking should reflect integration of expected value rather than bottom-up sensory responses — consistent with the role of higher-order cortical areas in predictive coding and decision-making.

**Hypothesis 3 — aHVAs encode value and PE; V1 encodes sensory features.** aHVAs, positioned higher in the cortical hierarchy, should preferentially encode expected value and PEs, whereas V1, at an earlier processing stage, should predominantly represent stimulus-driven sensory features.

### Trial Types and Key Analysis Windows

The task produces four trial types: **correct-rewarded (CR)**, **miss (MR)**, **false alarm unrewarded (FA)**, and **correct rejection (CRj)**. The key time windows: sound cue onset, environment identity (leaf or circle), first lick, and reward presence or absence.

### The 5-Step Methodology (6 months)

**Step 1 — Data cleaning (Month 1):** Adapt columns, define trials and epochs, align to key events. Neural signals binned at 25–50 milliseconds.

**Step 2 — Preprocessing (Month 2):** Split by region (aHVA vs. V1) and by learning day. This temporal split is essential — PE signaling should evolve across learning, and collapsing across days would mask the dynamics we are trying to detect.

**Steps 3–4 — TD model fitting (Months 3–4):** Fit a temporal-difference learning model to behavior to yield trial-wise latent estimates of expected value V(t) and prediction error δ(t):



$$
\delta(t) = r(t) + \gamma V(t+1) - V(t), \qquad V(t) \leftarrow V(t) + \alpha \cdot \delta(t)
$$



Test how past outcomes (V(t−1), δ(t−1)) bias baseline neural activity, anticipatory ramping in aHVAs, and subsequent licking behavior. Assess how early versus late reward delivery affects PE signals and their influence on subsequent trials. Simulate a TD/Q-learning agent in the corridor task to evaluate whether synthetic V(t) and δ(t) trajectories align with cortical activity — providing a quantitative bridge between RL models and neural data.

**Step 5 — Neural encoding (Months 5–6):** Fit a single-neuron encoding GLM per region, with emphasis on anticipation timing. Decode upcoming outcomes (correct vs. error) using pre-lick bins.

### Evaluation

Model comparison via AIC/BIC against a static stimulus-response baseline. Cross-validation via blocked and time-aware folds within sessions, plus leave-one-mouse-out holdouts across sessions — testing whether the value and PE model generalizes across individuals.

### Broader Significance

Understanding prediction error dynamics in visual cortex has implications beyond mouse neuroscience. PE signaling is implicated in schizophrenia, autism spectrum disorder, and addiction — conditions where the brain's ability to update internal models from feedback is disrupted. A circuit-level account of how aHVAs encode PE rather than sensory features would identify a concrete computational target for understanding these disruptions.

---

## References

1. Zhong, L. et al. (2025). Unsupervised pretraining in biological neural networks. *Nature*.
2. O'Doherty, J.P., Dayan, P., Friston, K., Critchley, H., & Dolan, R.J. (2003). Temporal difference models and reward-related learning in the human brain. *Neuron*, 38(2), 329–337.
3. Schultz, W., Dayan, P., Montague, P.R. (1997). A neural substrate of prediction and reward. *Science*, 275(5306), 1593–1599.
4. Picart, D., Bayar, C., Karimova, N., Nathaniel, R. et al. (2025). *Dynamics of Neural Correlates of Reward Anticipation and Prediction Error in the Mouse Visual Cortex.* Neuromatch Academy Impact Scholars Proposal.

*Code is maintained in a private repository.*
