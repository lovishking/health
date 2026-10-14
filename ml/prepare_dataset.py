"""
Dataset Preparation and Partitioning Pipeline for RT-HDSS
Prepares features, chronological sequences, and patient-level train/validation/test splits.
"""

from typing import Tuple, List, Dict, Any
import numpy as np


def create_patient_level_split(
    patient_ids: List[str],
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
    random_seed: int = 42
) -> Tuple[List[str], List[str], List[str]]:
    """
    Split patients strictly at the patient ID level to guarantee
    zero data leakage between train, validation, and test splits.
    """
    rng = np.random.RandomState(random_seed)
    shuffled = list(patient_ids)
    rng.shuffle(shuffled)

    n_total = len(shuffled)
    n_train = int(n_total * train_ratio)
    n_val = int(n_total * val_ratio)

    train_ids = shuffled[:n_train]
    val_ids = shuffled[n_train:n_train + n_val]
    test_ids = shuffled[n_train + n_val:]

    return train_ids, val_ids, test_ids
