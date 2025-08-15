package com.farm.controller;

import com.farm.entity.Expense;
import com.farm.repository.ExpenseRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/expenses")
@CrossOrigin
public class ExpenseController {
    private final ExpenseRepository expenseRepository;
    public ExpenseController(ExpenseRepository expenseRepository) { this.expenseRepository = expenseRepository; }

    @GetMapping
    public List<Expense> getAll() { return expenseRepository.findAll(); }

    @GetMapping("/{id}")
    public ResponseEntity<Expense> getById(@PathVariable Long id) {
        return expenseRepository.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Expense create(@RequestBody Expense expense) { return expenseRepository.save(expense); }

    @PutMapping("/{id}")
    public ResponseEntity<Expense> update(@PathVariable Long id, @RequestBody Expense update) {
        return expenseRepository.findById(id).map(e -> {
            e.setExpenseTitle(update.getExpenseTitle());
            e.setAmount(update.getAmount());
            e.setCategory(update.getCategory());
            e.setDescription(update.getDescription());
            e.setExpenseDate(update.getExpenseDate());
            return ResponseEntity.ok(expenseRepository.save(e));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!expenseRepository.existsById(id)) return ResponseEntity.notFound().build();
        expenseRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}


