# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

import re
from typing import List


def validate_code(code: str, allowed_imports: List[str] = None) -> bool:
    """
    Validates code for security by checking for allowed imports and forbidden patterns.
    
    :param code: The code string to validate
    :param allowed_imports: List of explicitly allowed import statements. If None,
                          defaults to common visualization imports.
    :return: True if code is valid, False otherwise
    """
    if allowed_imports is None:
        allowed_imports = [
            "import plotly.graph_objects as go",
            "import plotly.express as px"
        ]
        
    # Forbidden patterns, e.g., imports, filesystem access, etc.
    forbidden_patterns = [
        r'\bimport\b', r'\bexec\b', r'\beval\b',
        r'\bos\.', r'\bsys\.', r'\bsubprocess\.', r'\bopen\('
    ]

    # Split code into lines to process import statements individually
    lines = code.split('\n')
    for line in lines:
        stripped_line = line.strip()
        if stripped_line.startswith('import'):
            if stripped_line not in allowed_imports:
                return False
        else:
            # Check for any forbidden patterns in the rest of the code
            if any(re.search(fp, stripped_line) for fp in forbidden_patterns):
                return False

    return True 