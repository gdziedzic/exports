#!/usr/bin/env python3
"""
DAO - Database Analysis & Ontology

Entry point for running DAO as a module: python -m dao
"""

import sys
from .cli.main import main

if __name__ == "__main__":
    sys.exit(main())
