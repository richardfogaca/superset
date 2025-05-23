/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { interceptV1ChartData } from './utils';

describe('Advanced analytics', () => {
  beforeEach(() => {
    interceptV1ChartData();
    cy.intercept('PUT', '**/api/v1/explore/**').as('putExplore');
    cy.intercept('GET', '**/explore/**').as('getExplore');
  });

  it('Create custom time compare', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@v1Data' });

    cy.get('.ant-collapse-header')
      .contains('Advanced analytics')
      .click({ force: true });

    cy.get('[data-test=time_compare]').find('.ant-select').click();
    cy.get('[data-test=time_compare]')
      .find('input[type=search]')
      .type('28 days{enter}');

    cy.get('[data-test=time_compare]').find('input[type=search]').clear();
    cy.get('[data-test=time_compare]')
      .find('input[type=search]')
      .type('1 year{enter}');

    cy.get('button[data-test="run-query-button"]').click();
    cy.wait('@v1Data');
    cy.wait('@putExplore');

    cy.reload();
    cy.verifySliceSuccess({
      waitAlias: '@v1Data',
    });
    cy.wait('@getExplore');
    cy.get('.ant-collapse-header')
      .contains('Advanced analytics')
      .click({ force: true });
    cy.get('[data-test=time_compare]')
      .find('.ant-select-selector')
      .contains('28 days');
    cy.get('[data-test=time_compare]')
      .find('.ant-select-selector')
      .contains('1 year');
  });
});
