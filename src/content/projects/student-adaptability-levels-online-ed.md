---
title: "Student Adaptability Level Classifier in Online Education"
description: "Extensive EDA with Python, pandas, and matplotlib, plus supervised ML with scikit-learn — training and evaluating classification models for student adaptability."
date: 2023-07-01
langs: [Python]
tags: ["Data Science", "Machine Learning", "Classification", "Education", "Equity"]
published: true
featured: true
section: professional
---


In this project, I conducted an extensive Exploratory Data Analysis using Python, Pandas and matplotlib, explored Supervised Machine Learning Models using scikit-learn and binary classification methods to train, modify, and evaluate the ability for students of certain demographics to adapt to online education platforms, and compared the machine learning models to determine which model had the best predictions.

### Introduction

In the ever-evolving landscape of education, the adaptability of students to online learning environments has become a critical factor in determining academic success. This project leverages supervised machine learning techniques to predict student adaptability levels using various binary classification models. The goal is to develop a predictive model that can effectively classify students into different adaptability categories—Low, Moderate, and High—based on their responses to a set of questions.

This article presents a detailed analysis of the methods and techniques employed in this project, from exploratory data analysis (EDA) to feature engineering, model building, and evaluation. The project was conducted using a dataset of student responses, and the models were evaluated on their ability to accurately predict adaptability levels, offering insights into the potential applications of such a predictive model in real-world educational settings.

The data was collected during the COVID-19 Pandemic during December 10th, 2020 - February 5th, 2021 from both an online and in-person survey, & the location where the data was collected was in the country of Bangladesh. It is also important to note that the school system in Bangladesh is different to that in the United States: while the US has K-12 as schooling, Bangladesh considers 11th & 12th grade to be college, which is important to note since Education Level is a critical feature in our dataset.

**\*\*Important Note:\*\*** Since there are only 1205 datapoints in this dataset, it would be unreasonable to broadly assume that the trends we have observed apply to the entire population of Bangladeshi students, considering there are millions of students throughout the country. Unfortunately, not much context beyond a broad description was given, so we do not know the details of how the data was collected, nor in what regions. However, this data could still prove useful to education policy-makers if this data was recorded in a particular region.

### Hypothesis

In regards to our EDA, the hypothesis of this project is that demographics & access to technological support are important factors in determining whether or not students will properly adapt to online education. Let's consider the following conjecture: A student's age, financial conditions, access to educational support, and technology devices will be significant factors in determining a student's ability to adapt. The higher a student's age, the less likely they are to adapt. The higher the access to support in both technology and education, the better students will adapt. The better a student's financial conditions, the more likely they are to adapt to online education.

In regards to Machine Learning Model Building & Evaluation, the hypothesis is that specific features in the dataset—such as the students' responses to various regarding demographics, socioeconomic backgrounds, and accessibility to technology and other assistive learning systems—can be used to accurately predict their adaptability to online learning. By employing binary classification techniques, the project aimed to determine whether machine learning models could distinguish between students with different adaptability levels with a high degree of accuracy.

### Exploratory Data Analysis

Before diving into the model-building process, an in-depth exploratory data analysis (EDA) was conducted to understand the distribution and relationships within the dataset. The dataset included various features, such as demographic information and students' self-reported levels of comfort and adaptability in online learning environments, as shown below.

![](/images/student-adaptability-image-6.png)

Key findings from the EDA included:

- **Distribution of Adaptability Levels:** The dataset was imbalanced, with a higher number of students reporting 'Moderate' adaptability compared to 'Low' or 'High' adaptability.
- **Correlation Analysis:** Some features showed a strong correlation with adaptability levels, providing a foundation for feature selection during the modeling process.

<div class="img-carousel">
<figure><img src="/images/student-adaptability-student_education_level.png" alt="Gender vs Education Level distribution" /><figcaption>Gender vs. Education Level — boys and girls across school, college, and university</figcaption></figure>
<figure><img src="/images/student-adaptability-studemt_adapt_finances.png" alt="Financial condition vs adaptability" /><figcaption>Financial Condition vs. Adaptability — economic status and online learning outcomes</figcaption></figure>
<figure><img src="/images/student-adaptability-student_corr.png" alt="Correlation heatmap across all features" /><figcaption>Correlation Map — feature relationships across Low, Moderate, and High adaptability levels</figcaption></figure>
</div>

Above, we can see the relationship between boys and girls and their respective education levels, the financial conditions of students and their respective abilities to adapt to online learning, and a correlation map which highlights the the features correlation between each Adaptability Level. From these graphs and the EDA conducted, we can determine a few findings:

- Majority of students are in the low/moderate adaptability levels

&nbsp;

- As Adaptability levels increase, so does the disparity between boys and girls, implying that girls are less likely to adapt to online education than boys

&nbsp;

- Poor people are more likely to be categorized in the low level, middle class people in the moderate level, and rich people in the high level

For full EDA Insights, please refer to the GitHub repository, linked at the end of the article.

### Feature Engineering Techniques

Feature engineering played a crucial role in preparing the data for machine learning models. The following techniques were employed:

**One-Hot Encoding:** The categorical feature representing adaptability levels was split into three binary variables corresponding to 'Low', 'Moderate', and 'High' adaptability. This allowed for the application of binary classification models to each adaptability level individually. Below, we can see a One Hot Encoder function which takes a Series and converts it to a binary 1, 0. For feature engineering of series with more than a binary set of data, we decide to One Hot Encode each option, since there weren't more than three different data points in the dataset.

```python
def ohenc(arr_to_convert, converted_df_name):
    # Prepare & reshape column for OHE
    column_as_array = np.array(arr_to_convert).reshape(-1, 1)
    # Initialize our encoder
    enc = OneHotEncoder(handle_unknown='ignore', sparse=False)
    # Fit the column
    enc.fit(column_as_array)
    # Note this is a nested array, so we have to unpack with [0]
    global ec
    ec = enc.categories_[0]
    # Transform column
    ohe_conv_array = enc.transform(column_as_array)
    # Set global variable so we can access created DataFrame outside the function
    global df_ohe
    # Concatenate into a seperate DataFrame to build our model
    df_ohe = pd.DataFrame(data=ohe_conv_array, columns=ec)
    # Finish out by setting the name of df_ohe
    converted_df_name = df_ohe

ohenc(df['Financial Condition'], fc)
```

**Handling Class Imbalance:** Given the imbalanced nature of the dataset, both random oversampling and undersampling techniques were applied to create balanced and unbalanced datasets. This allowed for a comparison of model performance under different sampling conditions.

```python
# Generate RandomUnderSampler transform object
undersample = RandomUnderSampler(sampling_strategy='majority')

# Generate RandomOverSampler transform object
oversample = RandomOverSampler(sampling_strategy='minority')

# Assign input data and labels to variables "inputs, X" and "outputs, y"
l_inputs, l_outputs = al_low.drop('Low', axis=1), al_low['Low']

m_inputs, m_outputs = al_mod.drop('Moderate', axis=1), al_mod['Moderate']

h_inputs, h_outputs = al_high.drop('High', axis=1), al_high['High']

# Fit the transform objects
# Undersample
ulX, uly = undersample.fit_resample(l_inputs, l_outputs)
umX, umy = undersample.fit_resample(m_inputs, m_outputs)
uhX, uhy = undersample.fit_resample(h_inputs, h_outputs)

# Oversample
olX, oly = oversample.fit_resample(l_inputs, l_outputs)
omX, omy = oversample.fit_resample(m_inputs, m_outputs)
ohX, ohy = oversample.fit_resample(h_inputs, h_outputs)
```

### Machine Learning Models and Evaluation

Three machine learning models were employed for binary classification:

1.  **Naive Bayes**
2.  **K-Nearest Neighbors (KNN)**
3.  **Random Forests**

We create our respective train_test_splits with our respective Adaptability Level Data Frames. In this case, we want to compare between balanced and unbalanced data, so we do this for both.

Note that we will toggle the `test_size` and `random_state` attributes to tune our model for greater accuracy.

```python
# Original
l_X_train, l_X_test, l_y_train, l_y_test = train_test_split(l_X, l_y, test_size=0.25, random_state=50)
m_X_train, m_X_test, m_y_train, m_y_test = train_test_split(m_X, m_y, test_size=0.25, random_state=10)
h_X_train, h_X_test, h_y_train, h_y_test = train_test_split(h_X, h_y, test_size=0.25, random_state=100)

# Balanced
l_uX_train, l_uX_test, l_uy_train, l_uy_test = train_test_split(ulX, uly, test_size=0.25, random_state=50)
m_oX_train, m_oX_test, m_oy_train, m_oy_test = train_test_split(omX, omy, test_size=0.25, random_state=10)
h_uX_train, h_uX_test, h_uy_train, h_uy_test = train_test_split(uhX, uhy, test_size=0.25, random_state=100)
```

Below, we have an example of training and testing the ML model with balanced and unbalanced data.

![](/images/student-adaptability-image-4.png)

We determine the accuracy for each respective classification model.

```python
# Naive Bayes
def bnb_basic_cv(X, y, X_tr, X_ts, y_tr, y_ts, t_s=0.25, r_s=50):
    # Initialize empty list for meausring performance
    scores = []
    cv = 100

    for i in range(cv):
        # Create model
        gnb = GaussianNB()

        # For outside application - do not use when building future functions
        global l_uy_test
        global m_oy_test
        global h_uy_test

        X_tr, X_ts, y_tr, y_ts = train_test_split(X, y, test_size=t_s, random_state=r_s)

        gnb.fit(X_tr, y_tr)

        global by_pred

        by_pred = gnb.predict(X_ts)

        acc = accuracy_score(y_ts, by_pred)

        scores.append(acc)

        global b_basic_cv

        b_basic_cv = np.mean(scores)
```

Our Confusion Matrices give us a proper view of our TP, FP, FN, & TN, which help us determine Precision, Recall, and F1 Score. In this example (still Naive Bayes), we see less False Positives and False Negatives in our Balanced data.

![](/images/student-adaptability-image-8.png)

Each model was trained and evaluated on both the balanced and unbalanced datasets, with performance metrics including accuracy, precision, recall, and F1 score. The F1 score, in particular, was used as the primary metric for comparing model performance across different adaptability levels.

Below is a table summarizing the F1 scores for each model:

| *Model Test* | **Naïve Bayes** | **K Nearest Neighbors** | **Random Forests** |
|--------------|-----------------|-------------------------|--------------------|
| Low          | Bal: 0.70       | Bal: 0.735              | Bal: 0.785         |
| Moderate     | Bal: 0.64       | Bal: 0.785              | Bal: 0.835         |
| High         | Bal: 0.715      | Imb: 0.89               | Imb: 0.89          |
| **Average**  | **0.685**       | **0.803**               | **0.837**          |

The table demonstrates that the Random Forest model outperformed the other models in predicting adaptability levels, particularly when applied to the imbalanced dataset for the 'High' adaptability level.

### Conclusion

The results of this project underscore the potential of machine learning models in predicting student adaptability to online learning environments. The Random Forest model, in particular, achieved the strongest performance — an **average F1 score of 0.837** across all adaptability levels, versus 0.803 for KNN and 0.685 for Naïve Bayes — making it a strong candidate for deployment in educational settings.

These findings suggest that predictive models could be integrated into learning management systems to provide educators with real-time insights into student adaptability, allowing for tailored interventions that could improve educational outcomes. Future work could explore the integration of additional features and the application of more advanced machine learning techniques to further enhance predictive accuracy.

For more details and to view the complete project, please visit the [GitHub repository](https://github.com/dylanpicart/student_adaptability_level_classifier).
