package com.farm.controller;

import com.farm.entity.Activity;
import com.farm.entity.Expense;
import com.farm.repository.ActivityRepository;
import com.farm.repository.ExpenseRepository;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class ReportController {
    private final ExpenseRepository expenseRepository;
    private final ActivityRepository activityRepository;

    public ReportController(ExpenseRepository expenseRepository, ActivityRepository activityRepository) {
        this.expenseRepository = expenseRepository;
        this.activityRepository = activityRepository;
    }

    @GetMapping("/expenses/report/category")
    public Map<String, Double> expensesByCategory() {
        Map<String, Double> result = new HashMap<>();
        for (Expense e : expenseRepository.findAll()) {
            result.merge(e.getCategory(), e.getAmount(), Double::sum);
        }
        return result;
    }

    @GetMapping("/activities/report/type")
    public Map<String, Long> activitiesByType() {
        Map<String, Long> result = new HashMap<>();
        for (Activity a : activityRepository.findAll()) {
            result.merge(a.getType(), 1L, Long::sum);
        }
        return result;
    }

    @GetMapping("/expenses/report/date-range")
    public Double expensesTotalInRange(@RequestParam String start, @RequestParam String end) {
        LocalDate s = LocalDate.parse(start);
        LocalDate e = LocalDate.parse(end);
        return expenseRepository.findByExpenseDateBetween(s, e).stream().mapToDouble(Expense::getAmount).sum();
    }

    @GetMapping("/activities/upcoming")
    public List<Activity> upcoming(@RequestParam int days) {
        LocalDate now = LocalDate.now();
        return activityRepository.findByDateBetween(now, now.plusDays(days));
    }
}


