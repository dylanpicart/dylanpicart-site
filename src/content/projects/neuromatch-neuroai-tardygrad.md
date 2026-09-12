---
title: "TardyGrad: Benchmarking Biologically Plausible Learning Against Backpropagation"
description: "Project TardyGrad benchmarks Node Perturbation, Predictive Coding, and Hebbian Learning against Backpropagation on MNIST — in standard ANNs and Spiking Neural Networks — then tests all three under delayed reward conditions to probe the limits of gradient-free learning."
date: 2026-08-15
langs: [Python]
tags: ["NeuroAI", "Biologically Plausible Learning", "Research", "PyTorch"]
published: true
featured: false
section: research
---

**Neuromatch Academy — NeuroAI 2026 · Team: M. Miandari (TA), S. Bolotta (TA), D. Picart, V. Chokshi, A. G. Caldeira, L. Valenzuela, B. Bustos, S. Afridi, R. Zhou, J. Reback, J. Tabak**

Since brains learn remarkably well despite delays between actions and rewards, can we design artificial networks to do the same — and do it without backpropagation? That is the question at the center of Project TardyGrad. Over the summer, our nine-person team benchmarked biologically plausible (bio-plausible) learning rules against the dominant standard — backpropagation — across three experimental conditions: standard MNIST classification, Spiking Neural Networks, and a delayed-reward n-back task.

---

## The Problem with Backpropagation

Backpropagation (BP) is the workhorse of modern machine learning, but it carries three biological implausibilities that prevent it from being a plausible model of how the brain actually learns:

1. **Symmetric weight transport.** The forward and backward passes use identical weights, which requires a biological mechanism that doesn't exist — two neurons somehow sharing their weights in both directions simultaneously.
2. **Update locking.** No layer can update until the full backward pass has completed, which means all layers are frozen while the gradient propagates — biologically unrealistic in a system where learning is continuous.
3. **Downstream error dependence.** Every weight update requires knowledge of errors from layers that come *after* it, which means information must flow backward through the network in a precisely coordinated way.

Real biological learning avoids all three. Hebbian learning is local: neurons update based on their own pre- and post-synaptic activity. Predictive Coding uses local prediction errors. Node Perturbation uses a global scalar reward signal without any backward pass. The question is whether these bio-plausible alternatives can match backpropagation's performance.

---

## Three Research Questions

**Q1:** Can bio-plausible learning rules (Node Perturbation, Predictive Coding, Hebbian) match backpropagation on MNIST classification?

**Q2:** Do these learning rules generalize to Spiking Neural Networks, which are more biologically realistic than standard ANNs?

**Q3:** How does all of this degrade under delayed feedback — the realistic condition where reward arrives some time after the action that caused it?

---

## The Learning Rules

### Backpropagation (the benchmark)

The standard: compute the exact loss gradient via autograd, apply it via SGD. Every layer uses symmetric weights during the backward pass. No biological plausibility claims are made.

### Hebbian Learning — "Fire Together, Wire Together"

The weight change is simply the product of presynaptic input and postsynaptic output. No error signal, no backward pass, nothing but local correlation:

```python
class HebbianFunction(torch.autograd.Function):
    @staticmethod
    def forward(context, input, weight, bias=None, nonlinearity=None, target=None):
        output = input.mm(weight.t())
        # Output clamped to target at the last layer — the one concession to supervision
        if nonlinearity == "clamp" and target is not None:
            output = target.float()
        context.save_for_backward(input, weight, output)
        return output

    @staticmethod
    def backward(context, grad_output):
        # Hebbian update: pre × post, ignoring the upstream gradient entirely
        input, weight, output = context.saved_tensors
        grad_weight = -output.t().mm(input)  # accumulate correlations
        return None, grad_weight, None, None, None
```

The "output clamped" version replaces the actual output with the one-hot target at the final layer when computing the update, giving the top layer some supervision signal while keeping all hidden layers purely Hebbian.

### Node Perturbation — Learning by Noise

Node Perturbation estimates the gradient by running *two forward passes* and comparing the loss, without ever computing a backward pass:

**Clean pass:** run the network normally, record the loss L₀.
**Noisy pass:** inject random noise ξ into every neuron's activation, record the noisy loss Lξ.
**Update:** reinforce the perturbation if it helped (Lξ < L₀), reverse it if it hurt.

The weight update formula:



$$
\Delta W_l = \eta \cdot \frac{L_0 - L_\xi}{\sigma^2} \cdot \xi_l \, a_{l-1}^\top
$$



Where η is the learning rate, (L₀ − Lξ) is the global loss change, σ² is the noise variance, ξₗ is the postsynaptic noise, and aₗ₋₁ is the presynaptic activity. No symmetric weight transport, no update locking, no downstream error signals — three problems, one mechanism.

![Node Perturbation — MLP with learning without backpropagation. The four-step pipeline: Clean pass (compute L₀) → Perturb (add neural noise ξ) → Noisy pass (compute Lξ) → Local update (reinforce or reverse). Formula: ΔWₗ = η · (L₀ − Lξ) / σ² · ξₗ aₗ₋₁ᵀ. No symmetric weight transport, no update locking, no downstream error signals.](/images/tardygrad-slide-node-perturbation.jpg)

```python
class NodePerturbationMultiLayerPerceptron(MultiLayerPerceptron):
    def node_perturbation_step(self, X, y, sigma=0.1):
        # Clean forward pass
        with torch.no_grad():
            logits_clean = self.forward(X)
            loss_clean = F.cross_entropy(logits_clean, y).item()

        # Perturbed forward pass — noise injected at every hidden layer
        noise = {}
        with torch.no_grad():
            x = X.view(-1, self.num_inputs)
            for name, layer in self.named_modules():
                if isinstance(layer, torch.nn.Linear):
                    x = layer(x)
                    xi = torch.randn_like(x) * sigma
                    noise[name] = (xi, x.clone())
                    x = x + xi
            loss_pert = F.cross_entropy(x, y).item()

        # Update: reinforce if loss decreased, reverse if it increased
        reward = (loss_clean - loss_pert) / (sigma ** 2)
        for name, layer in self.named_modules():
            if isinstance(layer, torch.nn.Linear) and name in noise:
                xi, pre = noise[name]
                layer.weight.grad = -reward * xi.t().mm(pre)
```

### Predictive Coding — Learning by Local Prediction Error

A Predictive Coding Network (PCN) doubles the neurons: every layer l carries **value nodes xₗ** (the network's belief) paired with **error nodes εₗ** (the mismatch between prediction and reality). The whole network minimizes a single free energy F = ½ Σₗ ‖εₗ‖².

Learning happens in two phases:

**Inference (fast):** Hold the image fixed at x₀, clamp the label at xₗ, and let every other value node relax to minimize its prediction error:



$$
\frac{dx_l}{dt} = \gamma \left( -\varepsilon_l + f'(x_l) \cdot W_{l+1}^\top \varepsilon_{l+1} \right)
$$



**Weight update (slow):** Freeze xₗ and nudge Wₗ toward `εₗ f(xₗ₋₁)ᵀ` — error times input, both present at that synapse. This is a purely local update: each synapse only needs information available at its own location.

The result is a network that descends the same loss surface as backpropagation, but using only local information at each synapse.

---

## Q1 Results: MNIST Classification (ANN)

| Learning Rule | Test Accuracy |
|---|---|
| Backpropagation | **99%** |
| Predictive Coding | **99%** |
| Node Perturbation | **99%** |
| Hebbian (output clamped) | 36% |

![MNIST results — Backprop 99%, Predictive Coding 99%, Node Perturbation 99%, Hebbian 36%. The three bio-plausible rules that include an error signal (PC and NP) converge immediately to backprop accuracy; Hebbian oscillates near chance throughout 10 epochs.](/images/tardygrad-slide-mnist-results.jpg)

**Predictive coding and node perturbation match backpropagation.** The Hebbian rule collapses to near chance. 

The loss curves show an interesting nuance: Predictive Coding's cross-entropy is inflated by a scale artefact (it's trained with squared error on a linear output, not cross-entropy), but its accuracy matches exactly. The weight updates produced by PC's relaxation procedure are essentially identical to the true backprop gradient — cosine similarity ≈ 1.0 — confirming that PC is climbing the same hill without computing a gradient.

**Why does Hebbian fail?** The Hebbian rule has no error term, so nothing ever tells a weight it has gone too far. Weights grow without bound, saturating the hidden layer's sigmoid units and collapsing the representation to a near-binary code. This is a fundamental problem with pure correlation-based learning, not a tuning issue. A simple fix — centering the weight rows over time — partially recovers performance, but doesn't close the gap with error-based methods.

---

## Q2 Results: Spiking Neural Networks

Spiking Neural Networks (SNNs) encode information in discrete spikes across time rather than continuous activations, making them more biologically realistic. We tested the same four learning rules on an SNN.

| Learning Rule | SNN Performance |
|---|---|
| Backpropagation | ANN 97% → SNN 95% — small, graceful degradation |
| Predictive Coding | ANN 92% → SNN 90% — matched BPTT closely |
| Node Perturbation | ANN 84% → SNN **52%** — large drop; noisy and unstable |
| Hebbian | ANN 10% → SNN 12% — failed in both settings |

![SNN Test Accuracy on Four Learning Rules. Left: training curves — Backprop and PC converge quickly, NP is noisy and unstable, Hebbian stays at chance. Right: ANN vs SNN comparison — Backprop 97%/95%, PC 92%/90%, NP 84%/52% (large drop in SNN), Hebbian 10%/12%.](/images/tardygrad-slide-snn-results.jpg)

BP and PC generalize to SNNs; NP and Hebbian do not.

Node Perturbation's instability in the SNN setting is significant. The NP update assumes that the loss change is informative about the gradient, but in SNNs the discrete spiking dynamics make the loss landscape highly non-smooth — small perturbations produce discontinuous changes, and the reward signal becomes too noisy to guide learning reliably. **This identifies a meaningful boundary for gradient-free learning: NP works in smooth continuous networks, but struggles where discrete dynamics dominate.**

---

## Q3 Results: Delayed Reward — the n-back Task

In real biological learning environments, reward doesn't arrive immediately after the action that caused it. Dopamine release is delayed, feedback is temporally uncertain. Q3 tests how the learning rules degrade under this realistic condition.

We formulated MNIST classification as a **probabilistic n-back task**: the network sees a sequence of digits, but the error signal for digit at position t arrives only n steps later. Can a recurrent network learn to classify despite this temporal gap?

**Architecture comparison:** We tested three architectures:
- Feedforward MLP — no memory, baseline
- Standard LSTM — designed for sequential tasks
- Spiking LSTM — biologically richer neuron model

**Critical engineering choices that unlocked performance:**
- **Layer normalization** — prevented vanishing/exploding gradients during delayed credit assignment
- **Learnable threshold** — adaptable firing threshold for Spiking LSTM neurons

![2-Digit Delay — Test accuracy per model over variable delay steps (deterministic and probabilistic). LSTM and Spiking LSTM maintain high accuracy at short delays; MLP degrades faster. Probabilistic delay degrades performance more sharply across all models.](/images/tardygrad-slide-delay-2digit.jpg)

![10-Digit Delay — Performance degrades faster still. Spiking LSTM shows the most robust performance at longer delays, suggesting temporal dynamics help with harder credit-assignment problems.](/images/tardygrad-slide-delay-10digit.jpg)

**Results:** LSTMs untangle feedback delay; spiking networks achieved competitive performance across all conditions. Performance degrades faster as the delay window grows (2-digit delay vs. 10-digit delay). The Spiking LSTM showed more robust performance on the harder long-delay conditions — its inherent temporal dynamics provided an advantage exactly where it matters: under temporal uncertainty.

---

![Tied Answers — Q1: Yes, PC and NP perform as well as backprop; only Hebbian (no error term) collapses to chance. Q2: SNNs work as well as ANNs except when using Node Perturbation. Q3: Delayed feedback is a tough problem; Spiking LSTM shows more robust performance on harder conditions.](/images/tardygrad-slide-conclusions.jpg)

## Conclusions

**Q1 — Yes, bio-plausible rules can match backpropagation.** Predictive Coding and Node Perturbation both achieve 99% on MNIST. The Hebbian rule's failure is a feature, not a bug — it shows that *some* form of error signal is necessary, but it doesn't have to be the global gradient computed by backpropagation.

**Q2 — SNNs work as well as ANNs, except when using Node Perturbation.** NP's instability in the spiking setting reveals a meaningful boundary: gradient-free learning by perturbation requires smooth, continuous dynamics to produce informative reward signals.

**Q3 — Delayed feedback is solvable, but hard.** LSTMs handle temporal gaps that destroy simple recurrent networks. The Spiking LSTM's performance advantage grows as the delay lengthens — suggesting that biological temporal dynamics are themselves part of the solution to the delayed credit assignment problem.

The deepest finding is architectural: bio-plausible learning is not one thing. Node perturbation and predictive coding solve the same problem differently, and their failure modes under spiking dynamics and temporal delay are informative about what those differences actually mean for the brain.

---

## References

1. Lillicrap, T.P. et al. (2020). Backpropagation and the brain. *Nature Reviews Neuroscience*, 21, 335–346.
2. Kobayashi, S. & Schultz, W. (2008). Influence of reward delays on responses of dopamine neurons. *J. Neuroscience*, 28, 7837–7846.
3. Eshraghian, J.K. et al. (2021). Training spiking neural networks using lessons from deep learning. *arXiv:2109.12894*.
4. Bellec, G. et al. (2020). A solution to the learning dilemma for recurrent networks of spiking neurons. *Nature Communications*, 11, 3625.
5. Fernández, J.G., Ahmad, N., & van Gerven, M. (2025). Noise-based reward-modulated learning. *arXiv:2503.23972*.

*Code is maintained in a private repository.*
